import {validateEnvironment} from './scripts/environment.mjs';

export default function nextConfig() {
  validateEnvironment(process.env);
  return {poweredByHeader:false,...(process.env.SEED_BUILD_TARGET==='staging'?{distDir:'.next-staging'}:{}),experimental:{serverActions:{bodySizeLimit:'256kb'}}};
}
