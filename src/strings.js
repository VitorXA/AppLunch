// Todos os textos da interface ficam aqui. Para traduzir ou adaptar ao vocabulário
// da sua instituição, edite este arquivo (ou crie outro e troque o import).

export const appName = import.meta.env.VITE_APP_NAME || 'AppLunch';
// Como a sua instituição chama o número de identificação do aluno (ex.: SUAP, RA, matrícula).
export const idLabel = import.meta.env.VITE_ID_LABEL || 'Matrícula';

export const strings = {
  loading: 'Carregando…',
  loadError: 'Não foi possível conectar ao servidor. Tente novamente.',
  retry: 'Tentar novamente',

  auth: {
    loginTitle: 'Entrar',
    signupTitle: 'Criar conta',
    identifier: `Digite sua ${idLabel.toLowerCase()}`,
    password: 'Digite sua senha',
    passwordHint: 'Mínimo de 8 caracteres',
    name: 'Seu nome completo',
    email: 'E-mail (opcional)',
    inviteCode: 'Código de convite',
    login: 'Entrar',
    signup: 'Cadastrar-se',
    toSignup: 'Não tem conta ainda? Clique para se cadastrar.',
    toLogin: 'Já tem conta? Entrar.',
    registrationClosed: 'Os cadastros estão fechados no momento.',
    working: 'Aguarde…',
  },

  header: { logout: 'Sair', meal: 'Refeitório', admin: 'Painel' },

  scan: {
    title: 'LEITURA FACIAL',
    enrollIntro: 'Antes de usar, cadastre o seu rosto. Ele será usado apenas para confirmar a sua identidade no refeitório.',
    consent:
      'Autorizo o uso da imagem do meu rosto para confirmar minha identidade no controle de refeições. Posso apagar esse cadastro a qualquer momento.',
    enrollButton: 'Cadastrar meu rosto',
    enrolled: 'Rosto cadastrado com sucesso!',
    startCamera: 'Ligar a câmera',
    cameraDenied: 'Não foi possível usar a câmera. Verifique a permissão do navegador (e se o site usa HTTPS).',
    scanAria: 'Escanear rosto',
    noMealNow: 'Nenhuma refeição disponível neste horário.',
    nextWindows: 'Horários:',
    mealNow: (label) => `Agora: ${label}`,
    done: (label) => `${label} registrado!`,
    alreadyDone: 'Você já registrou esta refeição hoje.',
    verifying: 'Verificando…',
    deleteFace: 'Apagar meu cadastro facial',
    deleteFacePrompt: 'Digite sua senha para apagar o cadastro do seu rosto:',
    faceDeleted: 'Cadastro facial apagado.',
    wrongPassword: 'Senha incorreta.',
  },

  admin: {
    title: 'Registros do dia',
    date: 'Data',
    total: 'Total',
    empty: 'Nenhum registro nesta data.',
    columns: { who: 'Aluno', identifier: idLabel, meal: 'Refeição', time: 'Hora' },
  },

  errors: {
    invalid_credentials: `${idLabel} ou senha incorretos.`,
    too_many_attempts: 'Muitas tentativas. Aguarde alguns minutos.',
    identifier_taken: `Esta ${idLabel.toLowerCase()} já está cadastrada.`,
    invalid_identifier: `${idLabel} inválida.`,
    invalid_name: 'Informe seu nome (2 a 100 caracteres).',
    invalid_email: 'Digite um e-mail válido (ex.: nome@exemplo.com).',
    weak_password: 'A senha precisa ter entre 8 e 128 caracteres.',
    registration_closed: 'Os cadastros estão fechados no momento.',
    invalid_invite_code: 'Código de convite inválido.',
    consent_required: 'É preciso autorizar o uso do rosto para continuar.',
    face_already_enrolled: 'Seu rosto já está cadastrado.',
    face_not_enrolled: 'Cadastre seu rosto antes de registrar a refeição.',
    face_mismatch: 'Não foi possível confirmar que é você. Tente de novo com boa iluminação.',
    no_face_detected: 'Nenhum rosto detectado. Centralize o rosto na câmera e tente de novo.',
    already_checked_in: 'Você já registrou esta refeição hoje.',
    outside_meal_window: 'Fora do horário de refeição.',
    invalid_image: 'Imagem inválida. Tente novamente.',
    image_too_large: 'Imagem grande demais.',
    recognition_unavailable: 'O serviço de reconhecimento facial está indisponível. Tente mais tarde.',
    unauthorized: 'Sua sessão expirou. Entre novamente.',
    forbidden: 'Você não tem permissão para isso.',
    network: 'Falha de conexão com o servidor.',
    unknown: 'Algo deu errado. Tente novamente.',
  },
};

export const errorMessage = (code) => strings.errors[code] ?? strings.errors.unknown;
