'use client';
import dynamic from 'next/dynamic';

/**
 * O editor é pesado. Carregá-lo à parte evita que a tela inicial do estúdio baixe o editor inteiro
 * (o que, às vezes, fazia a página ser montada duas vezes no carregamento).
 */
export const DiagrammerLoader = dynamic(() => import('./diagrammer').then(module => module.Diagrammer));
