import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/cyberdocs/delivery-message.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { buildOrderDeliveryMessage: message } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const templates = {
  link: 'Mi texto personalizado\nHola {cliente}\n{plataforma}: {link}\nGracias 💜',
  password: 'Tu clave: {contraseña}',
  combined: 'Bienvenida {cliente} 💜\n{plataforma}\n{link}\nClave: {contraseña}\nMi garantía y soporte\n{link}',
};
const saved = { client: 'Ana', platform: 'Servicio', link: 'https://example.test/e/saved?t=token', accessPassword: 'saved-password' };

test('a reopened delivery uses its saved password and the complete custom multiline template', () => {
  assert.equal(message(templates, saved, 'combined'), 'Bienvenida Ana 💜\nServicio\nhttps://example.test/e/saved?t=token\nClave: saved-password\nMi garantía y soporte\nhttps://example.test/e/saved?t=token');
});
test('switching orders or editing templates does not reuse a previous message', () => {
  message(templates, saved, 'combined');
  const next = { ...saved, client: 'Beto', link: 'https://example.test/e/other', accessPassword: 'other-password' };
  assert.equal(message({ ...templates, combined: '{cliente}: {link} / {contraseña}' }, next, 'combined'), 'Beto: https://example.test/e/other / other-password');
});
test('documents without protection use the custom link message without a fake password', () => {
  const unprotected = { ...saved, accessPassword: '' };
  assert.equal(message(templates, unprotected, 'combined'), 'Mi texto personalizado\nHola Ana\nServicio: https://example.test/e/saved?t=token\nGracias 💜');
  assert.equal(message(templates, unprotected, 'password'), '');
});
test('literal placeholders inside customer data are preserved rather than expanded again', () => {
  assert.equal(message({ ...templates, combined: '{cliente}: {contraseña}' }, { ...saved, client: '{link}', accessPassword: '$&{cliente}' }, 'combined'), '{link}: $&{cliente}');
});
