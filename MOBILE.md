# FinCouple — App Mobile (iOS e Android) com Capacitor

O app web (React + Vite, em `frontend/`) foi empacotado com **Capacitor** para virar
um app nativo de iOS e Android reaproveitando o mesmo código.

## O que já foi configurado

- Capacitor instalado (`@capacitor/core`, `cli`, `ios`, `android`, `app`, `status-bar`, `keyboard`)
- `frontend/capacitor.config.ts` — appId `com.fincouple.app`, appName `FinCouple`
- Pastas nativas geradas: `frontend/android/` e `frontend/ios/`
- `frontend/src/api/client.ts` — no app nativo usa URL **absoluta** do backend (`VITE_API_URL`)
- `backend/main.py` — CORS liberado para origens nativas (`capacitor://localhost`, `https://localhost`)
- Scripts em `frontend/package.json`: `mobile:sync`, `mobile:android`, `mobile:ios`

## Pré-requisito CRÍTICO: URL do backend

O app nativo **não** funciona com `localhost`. Antes de gerar qualquer build:

1. Publique o backend (ele já roda na Vercel).
2. Edite `frontend/.env.production` e coloque a URL pública real:
   ```
   VITE_API_URL=https://SEU-BACKEND.vercel.app
   ```

## Fluxo de trabalho (sempre que mudar o código React)

```bash
cd frontend
npm run build      # gera dist/
npx cap sync       # copia dist/ para android/ e ios/
```
Ou use os atalhos: `npm run mobile:android` / `npm run mobile:ios`.

---

## ANDROID (100% possível no Windows)

1. Instale o **Android Studio** (https://developer.android.com/studio).
2. `cd frontend && npm run mobile:android` (abre o projeto no Android Studio).
3. No Android Studio: escolha um emulador ou conecte um celular Android (modo
   desenvolvedor + depuração USB) e clique em **Run** (▶).
4. Para gerar o APK/AAB de publicação: **Build > Generate Signed Bundle / APK**.

---

## iOS (exige macOS + Xcode — veja opções abaixo)

A Apple **não** permite build de iOS no Windows. Escolha um caminho:

### Opção A — Mac físico (mais simples)
1. No Mac, instale **Xcode** (App Store) e o **CocoaPods** (`sudo gem install cocoapods`).
2. Copie o projeto para o Mac, `cd frontend && npm install`.
3. `npm run mobile:ios` (abre no Xcode).
4. Selecione um **Simulador** (ex: iPhone 15) e clique em **Run** (▶) para testar.

### Opção B — Build na nuvem sem Mac (a partir do Windows)
Use um CI que tem macOS: **Codemagic** (tem plano grátis) ou **Ionic Appflow**.
Você conecta o repositório GitHub e o serviço builda o `.ipa` e envia pro TestFlight.

### Opção C — Mac na nuvem
Alugar por hora: **MacinCloud**, **MacStadium**, **AWS EC2 Mac**.

---

## Publicar/validar no iOS (TestFlight)

1. Crie a conta **Apple Developer** ($99/ano): https://developer.apple.com/programs/
2. No **App Store Connect** (https://appstoreconnect.apple.com), crie o app
   com o Bundle ID `com.fincouple.app`.
3. No Xcode: **Product > Archive** → **Distribute App** → **App Store Connect**.
4. Em App Store Connect > **TestFlight**, adicione testadores (por e-mail).
5. Os testadores instalam o app **TestFlight** no iPhone e recebem o convite.
