import Link from 'next/link';

export const metadata = {title: 'Privacidade'};

export default function PrivacyPage() {
  return <article className="section" style={{maxWidth: 850, marginInline: 'auto', lineHeight: 1.8}}>
    <p className="eyebrow">Zangraf</p>
    <h1>Privacidade e seus dados</h1>
    <p>Esta página explica os dados utilizados no site Zangraf e no editor de álbuns.</p>
    <h2>Conta e login com Google</h2>
    <p>Ao escolher entrar com Google, recebemos seu nome, endereço de e-mail e foto de perfil para identificar sua conta e permitir o acesso aos seus pedidos. Não solicitamos acesso ao Gmail, Google Drive, contatos ou fotos da sua conta Google. As fotos do álbum são selecionadas e enviadas por você no editor.</p>
    <h2>Projetos e pedidos</h2>
    <p>Usamos as opções do produto, a personalização, os arquivos enviados e as informações do pedido para preparar e acompanhar sua compra. A equipe autorizada da Zangraf pode acessar os dados necessários ao atendimento e à produção.</p>
    <p>O editor também utiliza o armazenamento do navegador para guardar projetos e fotos no dispositivo. Limpar os dados do navegador pode remover esses projetos locais; eles não são automaticamente sincronizados entre dispositivos.</p>
    <h2>Armazenamento e serviços</h2>
    <p>Utilizamos cookies de sessão para manter o login e armazenamento local para preferências, como o tema claro ou escuro. O site utiliza Vercel para hospedagem e serviços de arquivos, Neon para o banco de dados e Google para a autenticação quando você escolhe essa opção. Esses serviços processam os dados necessários às respectivas funções.</p>
    <h2>Controle da sua conta</h2>
    <p>Você pode revogar a conexão com a Zangraf nas configurações da sua Conta Google. Para solicitar informações, correção ou exclusão dos dados mantidos pela Zangraf, entre em contato pelo e-mail <a href="mailto:atendimentos.zangrafweb@gmail.com">atendimentos.zangrafweb@gmail.com</a>. A remoção da conexão Google não exclui automaticamente os pedidos ou os dados já mantidos no site.</p>
    <p><Link href="/">Voltar ao site</Link></p>
  </article>;
}
