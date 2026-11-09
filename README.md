# Zangraf

Loja e diagramador em português, com Next.js, React, TypeScript, PostgreSQL, Better Auth e armazenamento privado Vercel Blob.

## Executar localmente

Use Node.js 24 e pnpm 11.25.0. Instale com `pnpm install --frozen-lockfile` e inicie com `pnpm dev`. A página local fica em `http://127.0.0.1:3000`.

`pnpm build` compila a aplicação. `pnpm build:vercel` prepara o banco e compila; só deve ser executado no ambiente de publicação autorizado. Não copie credenciais para o código.

## Go Live no VS Code (Mac)

Ao abrir esta pasta, permita a tarefa automática **Zangraf: iniciar site local**. Ela inicia o Next.js em `http://127.0.0.1:3000`. O botão **Go Live** abre uma página de entrada que encaminha para esse endereço. As edições aparecem pelo servidor de desenvolvimento do Next.js.

Se a tarefa não iniciar, use **Terminal → Executar Tarefa → Zangraf: iniciar site local**. Mantenha o terminal da tarefa aberto; parar o Live Server não encerra o Next.js. Para encerrar o Next.js, pressione Ctrl+C no terminal da tarefa. A versão local não contém as credenciais da hospedagem: login, banco e uploads dependem da configuração de ambiente; o catálogo pode ser visualizado localmente.

## Áreas

- `/`: apresentação da marca.
- `/albuns`, `/acessorios`, `/estojos`, `/kits-layflat`: catálogo público.
- `/carrinho` e `/revisar-pedido`: seleção, conferência e envio de pedidos.
- `/diagramador`: fotos, capas, lâminas, enquadramento, layouts, desfazer/refazer, salvamento local e prévia, acessível após configurar um produto.
- `/minha-conta/projetos`: projetos editáveis salvos no navegador.
- `/minha-conta/pedidos`: pedidos do cliente autenticado.
- `/admin`: produtos, conteúdo, equipe, pedidos, recebimentos e arquivos de impressão, com autorização no servidor.

## Impressão

As medidas exibidas são em centímetros e seguem os modelos oficiais por produto, gramatura e quantidade. Capas podem ser inteiras (frente, dorso e verso), somente frente ou ausentes, conforme o material. O miolo é gerado em JPGs por lâmina aberta, com metadados de 300 DPI. Guias de dobra não aparecem nos arquivos de impressão. Consulte `docs/DIAGRAMADOR.md` para regras e recursos.

## Catálogo e preços

O catálogo usa as fotografias reais enviadas pela Zangraf. Os preços de álbuns seguem a aba LAYFLAT: encadernado + quantidade × valor da lâmina da gramatura e acabamento escolhidos. Combinações sem preço confirmado ficam sob consulta. O álbum Acrílico tem fotografia por baixo; não existem álbuns transparentes separados. Kits Layflat já têm categoria e cadastro administrativo, aguardando produtos reais.

## Pedidos e arquivos

O pedido fica como rascunho durante o envio. Os JPGs são enviados diretamente ao armazenamento privado; o servidor confere tipo, tamanho, dimensões e resolução. Só depois de todos os arquivos conferidos o pedido passa a aguardando pagamento. Downloads exigem sessão do comprador ou de administrador.

Pagamento e frete são combinados com a equipe. O painel registra recebimentos efetivamente confirmados; o valor recebido integralmente e a conferência de todos os arquivos são requisitos para aprovar a produção. Não há cobrança automática ou gateway de pagamento conectado.

Limites atuais: até 60 lâminas por álbum (40 para capas 1500 gramas), 150 arquivos por pedido, 12 MB por JPG enviado e reserva conservadora de 700 MiB para o conjunto de uploads. Reservas de pedidos abandonados ainda requerem manutenção administrativa. Os originais editáveis continuam no navegador; só os JPGs finais são enviados. Duas abas com alterações concorrentes geram uma cópia de recuperação, preservando o projeto original.

## Banco e publicação

A configuração da Vercel usa pnpm e funções em São Paulo. `scripts/prepare-db.mjs` utiliza a conexão direta do PostgreSQL, prepara Better Auth e aplica os SQLs numerados. A importação `catalog-real-photos-v1` inclui o catálogo real somente uma vez, preserva produtos de mesmo identificador já existentes, desativa os modelos demonstrativos originais e define 15 lâminas para os álbuns. Publicações futuras não sobrescrevem as edições feitas no painel.

Variáveis principais: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e `BLOB_READ_WRITE_TOKEN`. O primeiro administrador pode ser inicializado com as duas variáveis transitórias `ADMIN_BOOTSTRAP_EMAIL` e `ADMIN_BOOTSTRAP_PASSWORD`; depois elas devem ser removidas ou esvaziadas e o projeto republicado. A inicialização não promove contas pré-existentes automaticamente.

## Pendências explícitas

- Completar combinações sob consulta e regras de frete. Acessórios, estojos e kits aguardam os dados comerciais dos produtos reais.
- Conectar a conta/serviço de e-mail para envio automático de produção. Hoje os arquivos são baixados pelo painel.
- Permissão exclusiva do administrador principal e lista de destinatários: alteração bloqueada pela ferramenta e não aplicada. Atualmente todos os administradores autorizados têm os mesmos poderes de equipe.
- Sincronização de projetos editáveis entre dispositivos, pagamento online e fluxo de recuperação de senha por e-mail.
- Validação operacional de impressão, envio e navegação com dados reais.

A imagem editorial é conceitual. As marcas e arquivos usados estão descritos em `docs/ASSETS.md`. O histórico de compilações e verificações está em `VERIFICACAO.md`.

## Tema e login Google

O botão de lua/sol fica no cabeçalho e no editor, mantém a preferência e usa transição circular quando o navegador suporta View Transitions. A logo clara original permanece; o modo noturno usa `public/brand/zangraf-noturno.png`.

O login social depende de `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` somente no servidor, além da autenticação existente. Configure o callback `https://projeto-zangraf.vercel.app/api/auth/callback/google` no Google Cloud. A conta responsável solicitada é `atendimentos.zangrafweb@gmail.com`. Sem credenciais, o botão informa que está indisponível. O Google não concede acesso administrativo automaticamente.
