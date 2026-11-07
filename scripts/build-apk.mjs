#!/usr/bin/env node
/**
 * Compila el APK de depuración apuntando a un backend.
 *
 *   npm run apk                      -> backend simulado en este computador (IP de la red local)
 *   npm run apk -- mock 192.168.1.20 -> backend simulado en esa IP
 *   npm run apk -- real              -> backend del profesor (environment.prod.ts)
 *
 * El APK queda en dist/FeedDrive-<destino>.apk. El celular debe estar en la misma red que el backend.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const [target = 'mock', ipArg] = process.argv.slice(2);
const MOCK_PORT = 8000;

function lanIp() {
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'));
  // Se prefiere la del Wi-Fi: es la red que comparte el celular.
  const wifi = Object.entries(networkInterfaces()).find(([name]) => /wi-?fi|wlan/i.test(name))?.[1];
  const preferred = wifi?.find((i) => i.family === 'IPv4' && !i.internal);
  return (preferred ?? candidates[0])?.address;
}

const run = (command, options = {}) => {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: 'inherit', ...options });
};

let label;
if (target === 'real') {
  run('npx ng build --configuration production');
  label = 'real';
} else {
  const ip = ipArg ?? lanIp();
  if (!ip) throw new Error('No se encontró la IP de la red local. Pásala así: npm run apk -- mock 192.168.1.20');
  const api = `http://${ip}:${MOCK_PORT}/api`;
  console.log(`Backend del APK: ${api}`);
  run(`npx ng build --configuration device --define "FEEDDRIVE_API_URL='${api}'"`);
  label = `mock-${ip}`;
}

run('npx cap sync android');

// Gradle necesita un JDK compatible con los plugins de Capacitor (21).
const jdk21 = 'C:\\Program Files\\Microsoft\\jdk-21.0.13.21-hotspot';
const env = { ...process.env, ...(existsSync(jdk21) ? { JAVA_HOME: jdk21 } : {}) };
// Ruta explícita: algunas terminales no buscan ejecutables en la carpeta actual.
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
run(`${gradlew} assembleDebug -q`, { cwd: 'android', env });

mkdirSync('dist', { recursive: true });
const out = join('dist', `FeedDrive-${label}.apk`);
copyFileSync(join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), out);
console.log(`\nAPK listo: ${out}`);
