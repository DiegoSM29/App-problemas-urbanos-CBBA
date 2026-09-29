export const colors = {
  primary: '#0879BC',
  primaryDark: '#147EA9',
  accent: '#1389D1',
  secondary: '#11A86B',
  info: '#1389D1',
  success: '#2CB66D',
  warning: '#F4A32F',
  danger: '#EF6A5B',
  purple: '#7752D9',
  safe: '#358888',
  background: '#FFFFFF',
  hero: '#DDF1FA',
  border: '#D7E1E3',
  text: '#123653',
  textMuted: '#526D79',
  textFaint: '#5B7079',
  placeholder: '#9AA8AC',
  lightBlue: '#D9F0FC',
};

export const toneColor = {
  warning: colors.warning,
  info: colors.info,
  success: colors.success,
  danger: colors.danger,
};

export const statusTone = {
  Pendiente: 'warning',
  'En proceso': 'info',
  Resuelto: 'success',
};

export const statusColor = {
  Pendiente: colors.warning,
  'En proceso': colors.info,
  Resuelto: colors.success,
};

export const statuses = ['Pendiente', 'En proceso', 'Resuelto'];

export const categoryColor = {
  Vialidad: colors.warning,
  Iluminación: colors.primary,
  Limpieza: colors.purple,
  'Agua y Alcantarillado': colors.info,
  'Áreas Verdes': colors.success,
  Señalización: colors.danger,
  'Movilidad y Tránsito': '#0E9AA7',
  Otros: colors.textFaint,
};

export const categoryIcon = {
  Vialidad: '◆',
  Iluminación: '☼',
  Limpieza: '♻',
  'Agua y Alcantarillado': '≈',
  'Áreas Verdes': '❁',
  Señalización: '⚠',
  'Movilidad y Tránsito': '⇄',
  Otros: '●',
};

export const categories = [
  'Todos',
  'Vialidad',
  'Iluminación',
  'Limpieza',
  'Agua y Alcantarillado',
  'Áreas Verdes',
  'Señalización',
  'Movilidad y Tránsito',
  'Otros',
];

export const roles = ['Ciudadano', 'Administrador', 'Técnico'];