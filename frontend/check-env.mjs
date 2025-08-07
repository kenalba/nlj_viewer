console.log('Node env vars:');
console.log('VITE_API_BASE_URL:', process.env.VITE_API_BASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All VITE_ vars:');
Object.keys(process.env).filter(k => k.startsWith('VITE_')).forEach(k => console.log(k + ':', process.env[k]));
