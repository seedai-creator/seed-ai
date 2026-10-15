import type {Locale} from '@/lib/i18n/config';

// Mailbox confirmed by a send-and-reply test with the account owner.
export function SupportContact({locale}:{locale:Locale}) {
  const label=locale==='en-US'?'Contact support':locale==='es-ES'?'Contactar con soporte':'Falar com o suporte';
  return <p><a href="mailto:suporte@appseedai.com">{label}: suporte@appseedai.com</a></p>;
}
