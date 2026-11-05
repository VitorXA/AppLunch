# Política de segurança

## Reportando uma vulnerabilidade

**Não abra uma issue pública** para falhas de segurança. Use a aba **Security → Report a vulnerability** do repositório no GitHub (relatório privado de vulnerabilidade) ou contate os mantenedores de forma privada. Descreva o problema, como reproduzir e o impacto. Faremos o possível para responder em poucos dias.

> **Mantenedor do repositório:** ative o "Private vulnerability reporting" em *Settings → Code security*.

## O que o projeto já faz

- Senhas com `scrypt` + salt aleatório; comparação em tempo constante; resposta idêntica para "usuário inexistente" e "senha errada"
- Sessões com token aleatório de 256 bits (só o hash SHA-256 fica no banco), cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção
- Proteção CSRF: `SameSite=Strict` + exigência de `Content-Type: application/json`
- Limite de tentativas de login/cadastro/check-in
- Validação de imagens por magic bytes e limite de tamanho; limite de tamanho do corpo das requisições
- Consultas SQL parametrizadas; proteção contra path traversal nos arquivos estáticos
- Cabeçalhos de segurança (CSP, `X-Frame-Options`, `nosniff`, `Permissions-Policy`)
- O servidor se recusa a iniciar com reconhecimento facial `mock` em produção

## Limitações conhecidas

- Sem detecção de prova de vida (liveness) no reconhecimento facial.
- Sem recuperação de senha nem 2FA.
- Limitador de tentativas em memória (não compartilhado entre instâncias; reinicia com o servidor).
- Sem trilha de auditoria das ações de administrador.
- `node:sqlite` ainda é marcado como experimental no Node 22.

## Checklist para produção

- [ ] HTTPS na frente do app (Caddy, Nginx, Cloudflare…) e `TRUST_PROXY=true` **somente** se o proxy sobrescrever `X-Forwarded-For`
- [ ] `FACE_PROVIDER` real configurado (e testado com o seu público)
- [ ] `REGISTRATION_CODE` ou cadastro fechado
- [ ] Senha de admin forte; remover `ADMIN_PASSWORD` do `.env` depois do primeiro start
- [ ] Backup criptografado da pasta de dados (contém templates faciais)
- [ ] Revisão de [docs/PRIVACY.md](docs/PRIVACY.md) com o jurídico/DPO
