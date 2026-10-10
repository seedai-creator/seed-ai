import {validateEnvironment} from './scripts/environment.mjs';

export default function nextConfig() {
  validateEnvironment(process.env);
  return {poweredByHeader:false,experimental:{serverActions:{bodySizeLimit:'256kb'}}};
}
