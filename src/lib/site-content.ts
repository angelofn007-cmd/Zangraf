export type SiteContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  aboutTitle: string;
  aboutDescription: string;
  contactEmail: string;
  whatsapp: string;
  instagramUrl: string;
};

export const defaultSiteContent: SiteContent = {
  heroEyebrow: 'DA FOTOGRAFIA À MEMÓRIA',
  heroTitle: 'A vida acontece. O álbum fica.',
  heroDescription: 'Dê às suas fotografias um lugar para ficar. Escolha seu álbum, combine os detalhes e crie cada página do seu jeito.',
  aboutTitle: 'Feito para a sua maneira de contar histórias.',
  aboutDescription: 'Um espaço para fotógrafos e pessoas que acreditam que algumas memórias merecem sair da tela.',
  contactEmail: '',
  whatsapp: '',
  instagramUrl: '',
};

export function parseSiteContent(value: unknown): SiteContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Conteúdo inválido.');
  const input = value as Record<string, unknown>;
  const result = {} as SiteContent;
  for (const key of Object.keys(defaultSiteContent) as (keyof SiteContent)[]) {
    const field = input[key];
    const max = key.endsWith('Description') ? 1000 : 200;
    if (typeof field !== 'string' || field.length > max) throw new Error('Confira o campo ' + key + '.');
    result[key] = field.trim();
  }
  if (!result.heroTitle || !result.heroDescription || !result.aboutTitle || !result.aboutDescription) throw new Error('Preencha os títulos e os textos da página.');
  if (result.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contactEmail)) throw new Error('E-mail inválido.');
  if (result.whatsapp && !/^\d{10,15}$/.test(result.whatsapp)) throw new Error('WhatsApp deve conter somente números, com código do país e DDD.');
  if (result.instagramUrl) {
    let url: URL;
    try { url = new URL(result.instagramUrl); } catch { throw new Error('Link do Instagram inválido.'); }
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.username || url.password) throw new Error('Use um link HTTPS do Instagram.');
  }
  return result;
}

export type AdminSiteContent = SiteContent & {productionEmail: string};
export function parseAdminSiteContent(value: unknown): AdminSiteContent {
  const content = parseSiteContent(value);
  const productionEmail = (value as Record<string, unknown>).productionEmail;
  if (typeof productionEmail !== 'string' || productionEmail.length > 254 || (productionEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(productionEmail))) throw new Error('E-mail de produção inválido.');
  return {...content, productionEmail:productionEmail.trim()};
}
