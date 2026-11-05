# Privacidade e proteção de dados (LGPD)

> Este documento é um guia prático, **não é aconselhamento jurídico**. Antes de usar com alunos reais, consulte o encarregado de dados (DPO) / jurídico da sua instituição.

## Por que isso importa

O AppLunch coleta e trata:

| Dado | Onde fica | Observação |
| --- | --- | --- |
| Matrícula, nome, e-mail (opcional) | tabela `users` | Dados pessoais comuns |
| Senha | `users.password_hash` | Apenas o hash `scrypt`, nunca a senha |
| **Template facial** | `face_templates.template` | **Dado biométrico = dado pessoal sensível** (LGPD, art. 5º, II e art. 11) |
| Foto enviada no cadastro/check-in | **não é gravada** pelo servidor | É repassada ao provedor e descartada; confirme isso no seu provedor |
| Registros de refeição | tabela `meals` | Quem comeu, quando |

Além disso, os usuários são tipicamente **crianças e adolescentes**, o que exige cuidado adicional (LGPD, art. 14: tratamento no melhor interesse do menor; para crianças, consentimento específico de ao menos um dos pais ou responsável). Verifique com o jurídico o que se aplica à faixa etária dos seus alunos.

## O que o template já faz por você

- **Consentimento explícito e registrado**: o rosto só é cadastrado com `consent: true`, e a data fica em `face_templates.consent_at`.
- **Direito de eliminação**: o aluno apaga o próprio rosto (`DELETE /api/face`, exige senha) e o admin pode remover o de qualquer aluno.
- **Minimização**: nenhuma imagem é armazenada; só o template devolvido pelo provedor.
- **Senhas com hash** e sessões em cookie `HttpOnly`/`SameSite=Strict`.
- **Apagar em cascata**: remover um usuário do banco apaga sessões, template e registros dele (`ON DELETE CASCADE`).

## O que é responsabilidade da sua instituição

1. **Base legal e finalidade**: documente por que usa biometria (e se há alternativa menos invasiva, como QR code ou cartão) e informe os alunos/responsáveis com clareza.
2. **Consentimento dos responsáveis** para menores, quando aplicável. O texto padrão do consentimento está em `src/strings.js` (`scan.consent`); adapte-o à sua política.
3. **Relatório de Impacto (RIPD)** e registro das operações de tratamento, se exigidos.
4. **Política de retenção**: defina por quanto tempo guardar registros de refeição e templates (ex.: apagar templates de quem se formou/saiu). O template não tem expiração automática.
5. **Provedor de reconhecimento**: se usar nuvem, avalie contratos de operador, localização dos dados e transferência internacional.
6. **Segurança da infraestrutura**: HTTPS obrigatório, backups criptografados do `data/`, controle de acesso ao servidor e ao banco. Quem lê o banco lê os templates.
7. **Canal para titulares**: alguém precisa responder pedidos de acesso/eliminação (use `DELETE /api/admin/users/:id/face`).
8. **Alternativa para quem não consente ou não é reconhecido**: o uso de biometria não deve ser a única forma de acesso à merenda.

## Boas práticas recomendadas

- Rode atrás de HTTPS e deixe `COOKIE_SECURE` ativo.
- Use `REGISTRATION_CODE` ou `REGISTRATION_OPEN=false` para que só alunos reais criem conta.
- Revise regularmente quem tem papel `admin`.
- Não registre imagens nos logs do seu provedor de reconhecimento.
