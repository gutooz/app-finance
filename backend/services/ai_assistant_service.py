"""
Assistente financeiro do casal — powered by Ollama (LLM local).

Como funciona ("treino" do MVP):
  1. System prompt descreve TODAS as funcionalidades do sistema + contexto do casal.
  2. Function-calling (tools) liga o modelo aos serviços reais do backend, para que
     ele possa CONSULTAR e EXECUTAR ações (lançar gasto, pagar conta, criar meta...).
  3. A cada mensagem injetamos um retrato financeiro atualizado, então o assistente
     "entende o contexto" do que o usuário está falando.

Requisitos de execução:
  - Um servidor Ollama acessível (local: `ollama serve`; produção: uma VPS/GPU).
  - Um modelo com suporte a tools já baixado, ex.: `ollama pull llama3.1`
  - Variáveis de ambiente: OLLAMA_BASE_URL (default http://localhost:11434)
                          OLLAMA_MODEL    (default llama3.1)
"""

import json
import os
from datetime import date, datetime

import httpx

from backend.services import (
    bill_service,
    category_service,
    couple_service,
    expense_service,
    goal_service,
    summary_service,
)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
# Quantas rodadas de tool-calling permitimos antes de forçar uma resposta final.
MAX_TOOL_ROUNDS = 5
# Timeout generoso: modelos locais em CPU podem ser lentos na primeira resposta.
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "120"))


class OllamaUnavailable(Exception):
    """Ollama não está acessível ou o modelo não está disponível."""


# ─────────────────────────────────────────────────────────────────────────────
# Contexto financeiro — o que o assistente "sabe" sobre o casal
# ─────────────────────────────────────────────────────────────────────────────

def _money(v: float) -> str:
    return f"R$ {float(v or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_context(couple_id: str) -> dict:
    """Monta o retrato financeiro do casal para o mês corrente."""
    today = date.today()
    couple = couple_service.get_couple(couple_id) or {}
    summary = summary_service.get_monthly_summary(couple_id, today.month, today.year) or {}
    categories = category_service.get_couple_categories(couple_id)
    return {
        "couple": couple,
        "summary": summary,
        "categories": categories,
        "month": today.month,
        "year": today.year,
    }


def _resolve_user(context: dict, current_user_id: str, who: str | None) -> tuple[str, str]:
    """Resolve 'eu' / nome do parceiro -> (user_id, nome)."""
    couple = context["couple"]
    u1 = couple.get("user1") or {}
    u2 = couple.get("user2") or {}
    if not who or who.strip().lower() in ("eu", "mim", "eu mesmo", "eu mesma", "me"):
        target = current_user_id
    else:
        w = who.strip().lower()
        if u1.get("name", "").lower() == w or u1.get("id") == who:
            target = u1.get("id")
        elif u2.get("name", "").lower() == w or u2.get("id") == who:
            target = u2.get("id")
        else:
            target = current_user_id
    name = u1.get("name") if target == u1.get("id") else u2.get("name")
    return target, (name or "")


def build_system_prompt(context: dict, current_user_id: str) -> str:
    couple = context["couple"]
    summary = context["summary"]
    u1 = couple.get("user1") or {}
    u2 = couple.get("user2") or {}
    me_name = u1.get("name") if u1.get("id") == current_user_id else u2.get("name")
    cats = ", ".join(f"{c['value']}" for c in context["categories"]) or "outros"

    by_cat = summary.get("by_category") or {}
    top_cats = ", ".join(f"{k}: {_money(v)}" for k, v in list(by_cat.items())[:6]) or "sem gastos ainda"

    goals_txt = "; ".join(
        f"{g.get('emoji','')} {g['name']} ({_money(g['current'])}/{_money(g['target'])}, {g['percent']}%)"
        for g in summary.get("goals", [])
    ) or "nenhuma meta ativa"

    meses = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
             "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
    mes_nome = meses[context["month"]]

    return f"""Você é a **Fin**, a assistente financeira pessoal deste casal dentro do app FinCouple.
Fale sempre em português do Brasil, de forma calorosa, direta e prática — como uma amiga entendida de finanças. Use no máximo 1 emoji por resposta e evite textos longos.

## Quem é o casal
- Pessoa 1: {u1.get('name','?')} (renda mensal {_money(u1.get('monthly_income'))})
- Pessoa 2: {u2.get('name','?') if u2 else 'ainda não vinculada'} (renda mensal {_money(u2.get('monthly_income')) if u2 else '—'})
- Você está falando com: {me_name or 'usuário'}
- Modo de divisão dos gastos: {couple.get('split_mode','50_50')} (50_50 = metade cada; proportional = proporcional à renda)

## Situação atual ({mes_nome}/{context['year']})
- Total de gastos no mês: {_money(summary.get('total_expenses'))}
- Por categoria: {top_cats}
- {summary.get('balance_description','')}
- Contas fixas: total {_money(summary.get('bills_total'))}, pago {_money(summary.get('bills_paid'))}, pendente {_money(summary.get('bills_pending'))}
- Metas: {goals_txt}

## O que o app FinCouple faz (e você domina)
- **Gastos**: lançar despesas com valor, categoria e descrição. Cada gasto tem um tipo de divisão:
  - `couple` = gasto do casal, dividido conforme o modo de divisão;
  - `mine` = só de quem pagou; `partners` = pago por um, mas é dívida do outro;
  - `both` = os dois contribuíram (valores por pessoa).
- **Contas fixas**: cadastrar contas recorrentes (nome, valor, dia de vencimento), marcar como pagas, desfazer pagamento ou remover a conta.
- **Metas**: criar objetivos de poupança (nome, valor-alvo, emoji, prazo), registrar contribuições e apagar metas.
- **Categorias**: criar, renomear/trocar emoji e apagar categorias personalizadas. Categorias disponíveis: {cats}.
- **Resumo/Saldo**: total do mês, gastos por categoria, quem deve quanto para quem, contas e metas.
- **Contas bancárias (Open Finance/Pluggy)**: o casal pode conectar bancos e importar transações — isso é feito na tela "Bancos", você só explica (você não executa essa ação).

## Como agir
- Use as ferramentas disponíveis para CONSULTAR dados reais ou EXECUTAR ações — nunca invente números.
- Ao lançar um gasto, escolha a `category` mais próxima da lista real; se nada casar, use "outros".
- Quando o usuário disser algo como "gastei 50 no mercado", "paguei a conta de luz", "quero juntar 5 mil pra viagem", "apaga aquele gasto", "desfaz o pagamento da conta de luz", identifique a intenção e use a ferramenta certa.
- Antes de executar algo com valor alto, ambíguo, ou qualquer exclusão (delete_expense, delete_bill, delete_goal, delete_category), confirme rapidamente antes de agir — a menos que o usuário já tenha confirmado na mensagem. Para lançamentos claros, apenas faça e confirme o resultado.
- Depois de uma ação, responda com uma frase curta confirmando o que foi feito e um insight útil quando fizer sentido.
- Se o Ollama/ferramenta falhar, seja honesta sobre o que não deu certo."""


# ─────────────────────────────────────────────────────────────────────────────
# Definição das ferramentas (function-calling)
# ─────────────────────────────────────────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_financial_summary",
            "description": "Retorna o resumo financeiro do casal (total do mês, gastos por categoria, saldo/quem deve a quem, contas e metas). Use quando o usuário perguntar sobre a situação, saldo, quanto gastou, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "integer", "description": "Mês 1-12. Opcional, padrão mês atual."},
                    "year": {"type": "integer", "description": "Ano. Opcional, padrão ano atual."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_expenses",
            "description": "Lista os gastos do mês. Use para 'quais foram meus gastos', 'o que gastei em X', detalhamento.",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "integer"},
                    "year": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_expense",
            "description": "Registra um novo gasto/despesa. Use quando o usuário disser que gastou/comprou/pagou algo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Valor em reais, ex.: 49.90"},
                    "category": {"type": "string", "description": "Valor (slug) de uma categoria existente, ex.: mercado, gasolina. Se não souber, use 'outros'."},
                    "description": {"type": "string", "description": "Descrição curta do gasto."},
                    "split_type": {
                        "type": "string",
                        "enum": ["couple", "mine", "partners", "both"],
                        "description": "Como dividir. 'couple' (padrão) = do casal; 'mine' = só meu; 'partners' = do parceiro; 'both' = os dois.",
                    },
                    "paid_by": {"type": "string", "description": "Quem pagou: 'eu' (padrão) ou o nome da pessoa."},
                },
                "required": ["amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_bills",
            "description": "Lista as contas fixas do casal e se já foram pagas no mês atual.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_bill",
            "description": "Cadastra uma nova conta fixa recorrente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "amount": {"type": "number"},
                    "due_day": {"type": "integer", "description": "Dia do vencimento (1-31)."},
                },
                "required": ["name", "amount", "due_day"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "pay_bill",
            "description": "Marca uma conta fixa como paga no mês atual. Identifique a conta pelo nome.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome (ou parte) da conta a marcar como paga."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_goals",
            "description": "Lista as metas de poupança do casal e o progresso de cada uma.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_goal",
            "description": "Cria uma nova meta de poupança.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "target_amount": {"type": "number", "description": "Valor-alvo em reais."},
                    "emoji": {"type": "string", "description": "Um emoji que represente a meta."},
                },
                "required": ["name", "target_amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "contribute_goal",
            "description": "Registra uma contribuição/aporte em uma meta existente. Identifique a meta pelo nome.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome (ou parte) da meta."},
                    "amount": {"type": "number"},
                    "note": {"type": "string"},
                },
                "required": ["name", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_categories",
            "description": "Lista as categorias de gasto disponíveis para o casal.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_expense",
            "description": "Apaga um gasto lançado. Use list_expenses antes para achar o id certo se o usuário descrever o gasto (ex.: 'apaga o gasto do mercado de ontem').",
            "parameters": {
                "type": "object",
                "properties": {
                    "expense_id": {"type": "string", "description": "Id do gasto a apagar."},
                },
                "required": ["expense_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "unpay_bill",
            "description": "Desfaz o pagamento de uma conta fixa já marcada como paga no mês atual.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome (ou parte) da conta."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_bill",
            "description": "Remove uma conta fixa recorrente (deixa de existir, não é só desmarcar como paga).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome (ou parte) da conta a remover."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_goal",
            "description": "Apaga uma meta de poupança.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome (ou parte) da meta a apagar."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_category",
            "description": "Cria uma nova categoria de gasto personalizada.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "emoji": {"type": "string", "description": "Um emoji que represente a categoria."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_category",
            "description": "Renomeia ou troca o emoji de uma categoria existente. Identifique pelo nome atual.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome atual da categoria."},
                    "new_name": {"type": "string"},
                    "emoji": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_category",
            "description": "Remove uma categoria de gasto. Identifique pelo nome.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome (ou parte) da categoria a remover."},
                },
                "required": ["name"],
            },
        },
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Executor das ferramentas — liga cada tool aos serviços reais
# ─────────────────────────────────────────────────────────────────────────────

def _match_category(context: dict, value: str | None) -> str:
    if not value:
        return "outros"
    v = value.strip().lower()
    cats = context["categories"]
    for c in cats:
        if c["value"] == v or c["name"].lower() == v:
            return c["value"]
    # match parcial pelo nome
    for c in cats:
        if v in c["name"].lower() or v in c["value"]:
            return c["value"]
    return "outros"


def _find_by_name(items: list[dict], name: str, key: str = "name") -> dict | None:
    if not name:
        return None
    n = name.strip().lower()
    for it in items:
        if it.get(key, "").lower() == n:
            return it
    for it in items:
        if n in it.get(key, "").lower():
            return it
    return None


def execute_tool(name: str, args: dict, context: dict, couple_id: str, current_user_id: str) -> dict:
    """Executa uma ferramenta e devolve um dict serializável com o resultado."""
    today = date.today()
    try:
        if name == "get_financial_summary":
            m = int(args.get("month") or today.month)
            y = int(args.get("year") or today.year)
            return summary_service.get_monthly_summary(couple_id, m, y)

        if name == "list_expenses":
            m = int(args.get("month") or today.month)
            y = int(args.get("year") or today.year)
            return {"expenses": expense_service.get_monthly_expenses(couple_id, m, y)}

        if name == "add_expense":
            paid_by_id, paid_name = _resolve_user(context, current_user_id, args.get("paid_by"))
            category = _match_category(context, args.get("category"))
            result = expense_service.add_expense(
                couple_id=couple_id,
                paid_by_id=paid_by_id,
                amount=float(args["amount"]),
                category=category,
                description=(args.get("description") or "").strip(),
                split_type=args.get("split_type") or "couple",
                source="assistant",
            )
            return {"ok": True, "created": result, "paid_by_name": paid_name, "category_used": category}

        if name == "list_bills":
            return {"bills": bill_service.get_couple_bills(couple_id, today.month, today.year)}

        if name == "add_bill":
            result = bill_service.add_bill(
                couple_id=couple_id,
                name=str(args["name"]).strip(),
                amount=float(args["amount"]),
                due_day=int(args["due_day"]),
            )
            return {"ok": True, "created": result}

        if name == "pay_bill":
            bills = bill_service.get_couple_bills(couple_id, today.month, today.year)
            bill = _find_by_name(bills, args.get("name", ""))
            if not bill:
                return {"ok": False, "error": f"Conta '{args.get('name')}' não encontrada."}
            if bill.get("is_paid"):
                return {"ok": True, "already_paid": True, "bill": bill}
            bill_service.mark_bill_paid(bill["id"], current_user_id, today.month, today.year)
            return {"ok": True, "paid": bill}

        if name == "list_goals":
            return {"goals": goal_service.get_couple_goals(couple_id)}

        if name == "create_goal":
            result = goal_service.create_goal(
                couple_id=couple_id,
                name=str(args["name"]).strip(),
                target_amount=float(args["target_amount"]),
                emoji=(args.get("emoji") or "🎯").strip(),
            )
            return {"ok": True, "created": result}

        if name == "contribute_goal":
            goals = goal_service.get_couple_goals(couple_id)
            goal = _find_by_name(goals, args.get("name", ""))
            if not goal:
                return {"ok": False, "error": f"Meta '{args.get('name')}' não encontrada."}
            result = goal_service.add_contribution(
                goal["id"], current_user_id, float(args["amount"]), (args.get("note") or "").strip()
            )
            return {"ok": True, "goal": result}

        if name == "list_categories":
            return {"categories": context["categories"]}

        if name == "delete_expense":
            ok = expense_service.delete_expense(str(args["expense_id"]), couple_id)
            return {"ok": ok} if ok else {"ok": False, "error": "Gasto não encontrado."}

        if name == "unpay_bill":
            bills = bill_service.get_couple_bills(couple_id, today.month, today.year)
            bill = _find_by_name(bills, args.get("name", ""))
            if not bill:
                return {"ok": False, "error": f"Conta '{args.get('name')}' não encontrada."}
            ok = bill_service.unmark_bill_paid(bill["id"], today.month, today.year)
            return {"ok": ok, "bill": bill}

        if name == "delete_bill":
            bills = bill_service.get_couple_bills(couple_id, today.month, today.year)
            bill = _find_by_name(bills, args.get("name", ""))
            if not bill:
                return {"ok": False, "error": f"Conta '{args.get('name')}' não encontrada."}
            ok = bill_service.deactivate_bill(bill["id"], couple_id)
            return {"ok": ok, "removed": bill}

        if name == "delete_goal":
            goals = goal_service.get_couple_goals(couple_id)
            goal = _find_by_name(goals, args.get("name", ""))
            if not goal:
                return {"ok": False, "error": f"Meta '{args.get('name')}' não encontrada."}
            ok = goal_service.delete_goal(goal["id"], couple_id)
            return {"ok": ok, "removed": goal}

        if name == "create_category":
            result = category_service.create_category(
                couple_id=couple_id,
                name=str(args["name"]).strip(),
                emoji=(args.get("emoji") or "🏷️").strip(),
            )
            return {"ok": True, "created": result}

        if name == "update_category":
            cat = _find_by_name(context["categories"], args.get("name", ""))
            if not cat:
                return {"ok": False, "error": f"Categoria '{args.get('name')}' não encontrada."}
            result = category_service.update_category(
                cat["id"], couple_id, args.get("new_name"), args.get("emoji")
            )
            return {"ok": bool(result), "updated": result}

        if name == "delete_category":
            cat = _find_by_name(context["categories"], args.get("name", ""))
            if not cat:
                return {"ok": False, "error": f"Categoria '{args.get('name')}' não encontrada."}
            ok = category_service.delete_category(cat["id"], couple_id)
            return {"ok": ok, "removed": cat}

        return {"error": f"Ferramenta desconhecida: {name}"}
    except Exception as exc:  # noqa: BLE001 — devolvemos o erro para o modelo lidar
        return {"ok": False, "error": str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# Loop de conversa com o Ollama
# ─────────────────────────────────────────────────────────────────────────────

def _ollama_chat(messages: list[dict], use_tools: bool = True) -> dict:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.3},
    }
    if use_tools:
        payload["tools"] = TOOLS
    try:
        with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
            resp = client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
    except httpx.HTTPError as exc:
        raise OllamaUnavailable(
            f"Não consegui falar com o Ollama em {OLLAMA_BASE_URL}. "
            f"Verifique se ele está rodando (`ollama serve`) e se o modelo '{OLLAMA_MODEL}' foi baixado. Detalhe: {exc}"
        ) from exc
    if resp.status_code == 404:
        raise OllamaUnavailable(
            f"Modelo '{OLLAMA_MODEL}' não encontrado no Ollama. Rode: ollama pull {OLLAMA_MODEL}"
        )
    if resp.status_code >= 400:
        raise OllamaUnavailable(f"Ollama retornou erro {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def chat(
    couple_id: str,
    current_user_id: str,
    user_message: str,
    history: list[dict] | None = None,
) -> dict:
    """
    Processa uma mensagem do usuário com o assistente.

    history: lista de {role: 'user'|'assistant', content: str} das trocas anteriores.
    Retorna {reply: str, actions: [str], action_results: [dict], model: str}.
    action_results traz, para cada tool chamada, {name, args, result} — útil para quem
    chama `chat()` decidir efeitos colaterais (ex.: notificar o parceiro).
    """
    context = build_context(couple_id)
    system_prompt = build_system_prompt(context, current_user_id)

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for turn in (history or [])[-10:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    actions: list[str] = []
    action_results: list[dict] = []

    for _ in range(MAX_TOOL_ROUNDS):
        data = _ollama_chat(messages, use_tools=True)
        msg = data.get("message") or {}
        tool_calls = msg.get("tool_calls") or []

        # Preserva a mensagem do assistente (com tool_calls) no histórico da conversa
        messages.append(msg)

        if not tool_calls:
            reply = (msg.get("content") or "").strip()
            if not reply:
                reply = "Certo!"
            return {"reply": reply, "actions": actions, "action_results": action_results, "model": OLLAMA_MODEL}

        # Executa cada chamada de ferramenta e devolve o resultado ao modelo
        for call in tool_calls:
            fn = call.get("function") or {}
            fname = fn.get("name", "")
            raw_args = fn.get("arguments")
            if isinstance(raw_args, str):
                try:
                    fargs = json.loads(raw_args or "{}")
                except json.JSONDecodeError:
                    fargs = {}
            else:
                fargs = raw_args or {}

            result = execute_tool(fname, fargs, context, couple_id, current_user_id)
            actions.append(fname)
            action_results.append({"name": fname, "args": fargs, "result": result})
            messages.append({
                "role": "tool",
                "content": json.dumps(result, ensure_ascii=False, default=str),
            })

    # Estourou o limite de rodadas: pede uma resposta final sem ferramentas
    data = _ollama_chat(messages, use_tools=False)
    reply = ((data.get("message") or {}).get("content") or "Feito!").strip()
    return {"reply": reply, "actions": actions, "action_results": action_results, "model": OLLAMA_MODEL}


def health() -> dict:
    """Verifica se o Ollama está acessível e se o modelo está disponível."""
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{OLLAMA_BASE_URL}/api/tags")
        resp.raise_for_status()
        models = [m.get("name", "") for m in resp.json().get("models", [])]
        base = OLLAMA_MODEL.split(":")[0]
        available = any(m == OLLAMA_MODEL or m.split(":")[0] == base for m in models)
        return {
            "ok": True,
            "base_url": OLLAMA_BASE_URL,
            "model": OLLAMA_MODEL,
            "model_available": available,
            "installed_models": models,
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "base_url": OLLAMA_BASE_URL, "model": OLLAMA_MODEL, "error": str(exc)}
