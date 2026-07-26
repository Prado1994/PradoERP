import type { Contact, Deal, Email, StageDef, TeamMember } from './types'

export const initialContacts: Contact[] = [
  { id: 'c1', name: 'Marina Alves', company: 'TechNova', email: 'marina@technova.com', phone: '(11) 98221-4400', tag: 'Cliente', status: 'Ativo', initials: 'MA', color: 'accent' },
  { id: 'c2', name: 'Rafael Souza', company: 'Bytewave', email: 'rafael@bytewave.io', phone: '(11) 97711-2288', tag: 'Lead', status: 'Novo', initials: 'RS', color: 'info' },
  { id: 'c3', name: 'Camila Rocha', company: 'Órbita Digital', email: 'camila@orbita.co', phone: '(21) 98844-1120', tag: 'Cliente', status: 'Ativo', initials: 'CR', color: 'violet' },
  { id: 'c4', name: 'Diego Martins', company: 'Fluxo Log', email: 'diego@fluxolog.com', phone: '(31) 99022-7731', tag: 'Lead', status: 'Contato', initials: 'DM', color: 'warn' },
  { id: 'c5', name: 'Juliana Prado', company: 'Vértice Software', email: 'juliana@vertice.dev', phone: '(11) 96633-0091', tag: 'Cliente', status: 'Ativo', initials: 'JP', color: 'success' },
  { id: 'c6', name: 'Bruno Teixeira', company: 'NimbusCloud', email: 'bruno@nimbuscloud.com', phone: '(41) 98120-5567', tag: 'Lead', status: 'Proposta', initials: 'BT', color: 'info' },
  { id: 'c7', name: 'Larissa Nunes', company: 'Horizonte Pay', email: 'larissa@horizontepay.com', phone: '(51) 99345-8820', tag: 'Cliente', status: 'Ativo', initials: 'LN', color: 'accent' },
  { id: 'c8', name: 'Pedro Lima', company: 'Cursor Data', email: 'pedro@cursordata.ai', phone: '(19) 98876-3312', tag: 'Lead', status: 'Novo', initials: 'PL', color: 'warn' },
]

export const initialDeals: Deal[] = [
  { id: 'd1', company: 'TechNova', title: 'Plano Enterprise', contactId: 'c1', stageId: 'fechado', value: 48000, initials: 'MA', color: 'accent' },
  { id: 'd2', company: 'Bytewave', title: 'Onboarding inicial', contactId: 'c2', stageId: 'novo', value: 12000, initials: 'RS', color: 'info' },
  { id: 'd3', company: 'Órbita Digital', title: 'Upgrade anual', contactId: 'c3', stageId: 'negociacao', value: 32000, initials: 'CR', color: 'violet' },
  { id: 'd4', company: 'Fluxo Log', title: 'Plano Pro', contactId: 'c4', stageId: 'contato', value: 18000, initials: 'DM', color: 'warn' },
  { id: 'd5', company: 'Vértice Software', title: 'Renovação anual', contactId: 'c5', stageId: 'fechado', value: 27000, initials: 'JP', color: 'success' },
  { id: 'd6', company: 'NimbusCloud', title: 'Plano Team', contactId: 'c6', stageId: 'proposta', value: 22000, initials: 'BT', color: 'info' },
  { id: 'd7', company: 'Horizonte Pay', title: 'Plano Enterprise', contactId: 'c7', stageId: 'negociacao', value: 54000, initials: 'LN', color: 'accent' },
  { id: 'd8', company: 'Cursor Data', title: 'Trial para pago', contactId: 'c8', stageId: 'novo', value: 9000, initials: 'PL', color: 'warn' },
  { id: 'd9', company: 'TechNova', title: 'Add-on de API', contactId: 'c1', stageId: 'proposta', value: 15000, initials: 'MA', color: 'accent' },
  { id: 'd10', company: 'Bytewave', title: 'Plano Team', contactId: 'c2', stageId: 'contato', value: 20000, initials: 'RS', color: 'info' },
  { id: 'd11', company: 'Órbita Digital', title: 'Novo módulo', contactId: 'c3', stageId: 'novo', value: 17000, initials: 'CR', color: 'violet' },
  { id: 'd12', company: 'Vértice Software', title: 'Expansão de licenças', contactId: 'c5', stageId: 'contato', value: 24000, initials: 'JP', color: 'success' },
]

export const initialEmails: Email[] = [
  {
    id: 'e1', contactId: 'c1', contactName: 'Marina Alves', company: 'TechNova', subject: 'Dúvida sobre fatura de julho',
    preview: 'Oi, tudo bem? Recebi a fatura mas está com um valor diferente...', time: '09:42', unread: true, initials: 'MA', color: 'accent',
    thread: [
      { fromMe: false, name: 'Marina Alves', text: 'Oi, tudo bem? Recebi a fatura mas está com um valor diferente do combinado, pode verificar?', time: '09:40' },
      { fromMe: false, name: 'Marina Alves', text: 'Fico no aguardo, obrigada!', time: '09:42' },
    ],
  },
  {
    id: 'e2', contactId: 'c2', contactName: 'Rafael Souza', company: 'Bytewave', subject: 'Podemos agendar uma call?',
    preview: 'Gostaria de entender melhor os planos disponíveis...', time: '08:15', unread: true, initials: 'RS', color: 'info',
    thread: [
      { fromMe: false, name: 'Rafael Souza', text: 'Gostaria de entender melhor os planos disponíveis para nosso time de 12 pessoas.', time: '08:15' },
    ],
  },
  {
    id: 'e3', contactId: 'c3', contactName: 'Camila Rocha', company: 'Órbita Digital', subject: 'Feedback sobre novo dashboard',
    preview: 'O time adorou o novo painel de relatórios!', time: 'Ontem', unread: false, initials: 'CR', color: 'violet',
    thread: [
      { fromMe: false, name: 'Camila Rocha', text: 'O time adorou o novo painel de relatórios, ficou muito mais rápido de acompanhar as métricas.', time: 'Ontem' },
      { fromMe: true, name: 'Você', text: 'Que ótimo saber, Camila! Vou repassar o elogio pro time de produto.', time: 'Ontem' },
    ],
  },
  {
    id: 'e4', contactId: 'c6', contactName: 'Bruno Teixeira', company: 'NimbusCloud', subject: 'Proposta - próximos passos',
    preview: 'Analisamos a proposta internamente e temos duas perguntas...', time: '2 dias', unread: true, initials: 'BT', color: 'info',
    thread: [
      { fromMe: false, name: 'Bruno Teixeira', text: 'Analisamos a proposta internamente e temos duas perguntas sobre o SLA de suporte.', time: '2 dias' },
    ],
  },
  {
    id: 'e5', contactId: 'c7', contactName: 'Larissa Nunes', company: 'Horizonte Pay', subject: 'Renovação de contrato',
    preview: 'Confirmando a renovação para o próximo ciclo anual.', time: '3 dias', unread: false, initials: 'LN', color: 'accent',
    thread: [
      { fromMe: false, name: 'Larissa Nunes', text: 'Confirmando a renovação para o próximo ciclo anual, pode seguir com o novo contrato.', time: '3 dias' },
      { fromMe: true, name: 'Você', text: 'Perfeito, Larissa! Envio o novo contrato ainda hoje.', time: '3 dias' },
    ],
  },
  {
    id: 'e6', contactId: 'c8', contactName: 'Pedro Lima', company: 'Cursor Data', subject: 'Interesse no plano Pro',
    preview: 'Estamos no trial há 2 semanas e queremos migrar de plano.', time: '5 dias', unread: false, initials: 'PL', color: 'warn',
    thread: [
      { fromMe: false, name: 'Pedro Lima', text: 'Estamos no trial há 2 semanas e o time já quer migrar para o plano Pro.', time: '5 dias' },
    ],
  },
]

export const initialTeam: TeamMember[] = [
  { id: 't1', name: 'Você', email: 'voce@soucrum.com', role: 'Admin', initials: 'VC', color: 'violet' },
  { id: 't2', name: 'Marcos Vidal', email: 'marcos@soucrum.com', role: 'Vendas', initials: 'MV', color: 'accent' },
  { id: 't3', name: 'Ana Beatriz', email: 'ana@soucrum.com', role: 'Suporte', initials: 'AB', color: 'info' },
  { id: 't4', name: 'Felipe Rangel', email: 'felipe@soucrum.com', role: 'Marketing', initials: 'FR', color: 'warn' },
  { id: 't5', name: 'Sofia Cardoso', email: 'sofia@soucrum.com', role: 'Financeiro', initials: 'SC', color: 'success' },
]

/** Pipeline stage definitions. Colors adapt to the active theme. */
export function stageDefs(dark: boolean): StageDef[] {
  return [
    { id: 'novo', name: 'Novo Lead', color: dark ? '#FF9270' : '#FF6B45' },
    { id: 'contato', name: 'Contato Feito', color: dark ? '#5FD1CE' : '#4FBDBA' },
    { id: 'proposta', name: 'Proposta Enviada', color: dark ? '#FFC469' : '#FFB648' },
    { id: 'negociacao', name: 'Negociação', color: dark ? '#B3A6EA' : '#8B7FD1' },
    { id: 'fechado', name: 'Fechado', color: dark ? '#5FD9A6' : '#3FAE7A' },
  ]
}

export const viewTitles: Record<string, [string, string]> = {
  dashboard: ['Meu Painel', 'Visão geral do seu negócio hoje'],
  inbox: ['Caixa de Entrada', 'Conversas com seus contatos'],
  pipeline: ['Quadro', 'Acompanhe seus negócios por estágio'],
  contacts: ['Contatos', 'Todas as pessoas e empresas'],
  settings: ['Configurações', 'Sua conta, equipe e preferências'],
  hoje: ['Hoje', 'Suas tarefas e prioridades do dia'],
  projetos: ['Projetos', 'Todos os projetos em andamento'],
  documentos: ['Documentos', 'Arquivos e anotações da equipe'],
  materiais: ['Materiais', 'Biblioteca de materiais e recursos'],
  calendario: ['Calendário', 'Sua agenda e compromissos'],
  foco: ['Foco', 'Sessões de foco e produtividade'],
  relatorios: ['Relatórios', 'Relatórios e métricas detalhadas'],
  rotinas: ['Rotinas', 'Hábitos e rotinas recorrentes'],
}

export const placeholderContent: Record<string, [string, string, string]> = {
  hoje: ['🌅', 'Nada agendado para hoje', 'Suas tarefas e prioridades do dia aparecem aqui.'],
  projetos: ['📁', 'Nenhum projeto ainda', 'Crie um projeto para organizar seu trabalho.'],
  documentos: ['📄', 'Nenhum documento por aqui', 'Seus arquivos e anotações da equipe aparecem aqui.'],
  materiais: ['🧰', 'Biblioteca vazia', 'Adicione materiais e recursos para o time.'],
  calendario: ['🗓️', 'Agenda livre', 'Seus compromissos e eventos aparecem aqui.'],
  foco: ['🎯', 'Pronto para focar?', 'Inicie uma sessão de foco quando quiser.'],
  relatorios: ['📊', 'Nenhum relatório gerado', 'Relatórios detalhados aparecem por aqui.'],
  rotinas: ['🔁', 'Nenhuma rotina criada', 'Configure hábitos e rotinas recorrentes.'],
}
