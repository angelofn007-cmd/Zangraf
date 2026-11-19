/**
 * Administrador principal (dono): a única conta que pode remover o acesso de outros
 * administradores. Pode ser trocada pela variável de ambiente ZANGRAF_OWNER_EMAIL.
 */
export const OWNER_EMAIL = (process.env.ZANGRAF_OWNER_EMAIL || 'angelofn007@gmail.com').trim().toLowerCase();
export const isOwnerEmail = (email?: string | null) => !!email && email.trim().toLowerCase() === OWNER_EMAIL;
