(
    # Onboarding
    ONBOARD_NAME,
    ONBOARD_INCOME,
    ONBOARD_CHOICE,
    ONBOARD_TOKEN,
    ONBOARD_SPLIT,
    # Login
    LOGIN_EMAIL,
    LOGIN_PASSWORD,
) = range(7)

SPLIT_MODES = {
    "50_50": "50/50 — Metade cada um",
    "proportional": "Proporcional à renda",
}

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "mercado": ["mercado", "supermercado", "feira", "groceries", "compras"],
    "aluguel": ["aluguel", "rent", "aluguel"],
    "gasolina": ["gasolina", "combustível", "gas", "posto", "etanol"],
    "restaurante": ["restaurante", "comida", "lanche", "pizza", "ifood", "delivery", "jantar", "almoço", "hamburguer"],
    "transporte": ["uber", "99", "taxi", "táxi", "onibus", "ônibus", "metro"],
    "internet": ["internet", "wifi", "fibra", "net"],
    "saude": ["farmácia", "farmacia", "remédio", "remedio", "médico", "medico", "hospital", "consulta"],
    "pet": ["pet", "veterinário", "veterinario", "ração", "racao"],
    "streaming": ["netflix", "spotify", "amazon", "disney", "streaming", "hbo"],
    "lazer": ["cinema", "teatro", "show", "passeio", "viagem", "hotel"],
    "casa": ["casa", "móvel", "movel", "decoração", "decoracao", "reforma"],
    "pessoal": ["roupa", "beleza", "salão", "salao", "barbearia", "cabelo", "corte"],
}
