// Provedor de DESENVOLVIMENTO: aceita qualquer imagem como "o mesmo rosto".
// Serve para testar o fluxo completo sem um serviço de reconhecimento real.
// NÃO oferece nenhuma segurança — em produção o servidor se recusa a iniciar com ele.
export function createMockProvider() {
  return {
    name: 'mock',
    async enroll() {
      return { template: 'mock' };
    },
    async verify() {
      return { match: true, score: 1 };
    },
  };
}
