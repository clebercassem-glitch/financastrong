# Controle Financeiro PWA

PWA instalavel para Android usando a planilha do Controle Financeiro como base.

## Como testar localmente

1. Cole o `google-apps-script/Code.gs` atualizado no Apps Script da planilha.
2. Salve e implante uma nova versao do Web App.
3. Confirme que a URL publicada e a mesma em `app.js`, na constante `API_URL`.
4. Abra o app local:

```powershell
cd "C:\Users\clebe\OneDrive\Documentos\ChatGPT\Finanças PRO\financas-pwa"
python -m http.server 4173
```

Depois acesse:

```text
http://localhost:4173/
```

## Como publicar no GitHub Pages

Este projeto ja esta preparado para o GitHub Pages usando `.github/workflows/pages.yml`.

1. Suba este repositorio no GitHub.
2. No GitHub, abra `Settings` > `Pages`.
3. Em `Build and deployment`, selecione `GitHub Actions`.
4. Faca push na branch `main`.

O app devera ficar em:

```text
https://clebercassem-glitch.github.io/financastrong/
```

## Como publicar na Vercel

Pelo painel da Vercel, importe esta pasta como um projeto estatico.

Pela CLI:

```powershell
cd "C:\Users\clebe\OneDrive\Documentos\ChatGPT\Finanças PRO\financas-pwa"
npx vercel
```

Depois abra a URL publicada no Android e use o menu do navegador para instalar/adicionar a tela inicial.

## Seguranca opcional

Para proteger a ponte publica:

1. No Apps Script, adicione a propriedade `PWA_API_TOKEN`.
2. Em `app.js`, preencha a constante `PWA_API_TOKEN` com o mesmo valor.

Para uma distribuicao multiusuario, o ideal e evoluir para login Google e criacao automatica de uma copia da planilha modelo por usuario.
