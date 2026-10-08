export const productSku = () =>
  `PRD-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
