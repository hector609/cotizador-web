import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cotizador.hectoria.mx';
  const lastModified = new Date();

  return [
    { url: `${baseUrl}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/precios`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/vendedor-telcel`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/ayuda`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/descargar`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/login`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${baseUrl}/signup`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/privacidad`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terminos`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
