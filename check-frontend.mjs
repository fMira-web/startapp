/**
 * Статическая проверка фронтенда без сборки.
 *
 * Разбирает каждый файл babel-парсером (синтаксис и JSX), а затем сверяет
 * каждый относительный импорт с экспортами модуля-источника. Ловит опечатки
 * в именах и забытые экспорты — то, что иначе всплыло бы только в браузере.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { parse } from '@babel/parser';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const problems = [];
const modules = new Map();

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(jsx?|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'topLevelAwait', 'importMeta', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (error) {
    problems.push(`СИНТАКСИС ${file.replace(ROOT, '.')}:${error.loc?.line ?? '?'} — ${error.message}`);
    continue;
  }

  const named = new Set();
  let hasDefault = false;
  const imports = [];

  for (const node of ast.program.body) {
    if (node.type === 'ExportDefaultDeclaration') hasDefault = true;
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        if (node.declaration.id) named.add(node.declaration.id.name);
        for (const decl of node.declaration.declarations ?? []) {
          if (decl.id.type === 'Identifier') named.add(decl.id.name);
        }
      }
      for (const spec of node.specifiers ?? []) {
        const name = spec.exported.name ?? spec.exported.value;
        if (name === 'default') hasDefault = true;
        else named.add(name);
      }
    }
    if (node.type === 'ExportAllDeclaration') named.add('*');
    if (node.type === 'ImportDeclaration') {
      imports.push({
        source: node.source.value,
        specifiers: node.specifiers.map((spec) => ({
          kind: spec.type,
          imported: spec.imported?.name ?? spec.imported?.value ?? null,
          local: spec.local.name,
        })),
        line: node.loc.start.line,
      });
    }
  }

  modules.set(file, { named, hasDefault, imports });
}

function resolveImport(fromFile, source) {
  if (!source.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), source);
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, join(base, 'index.js'), join(base, 'index.jsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined; // не нашли вовсе
}

for (const [file, info] of modules) {
  for (const entry of info.imports) {
    const target = resolveImport(file, entry.source);
    if (target === null) continue; // внешний пакет
    if (target === undefined) {
      problems.push(`НЕТ ФАЙЛА ${file.replace(ROOT, '.')}:${entry.line} — "${entry.source}"`);
      continue;
    }
    const targetInfo = modules.get(target);
    if (!targetInfo) continue;
    for (const spec of entry.specifiers) {
      if (spec.kind === 'ImportDefaultSpecifier' && !targetInfo.hasDefault) {
        problems.push(
          `НЕТ DEFAULT ${file.replace(ROOT, '.')}:${entry.line} — "${entry.source}" не экспортирует default`
        );
      }
      if (spec.kind === 'ImportSpecifier' && !targetInfo.named.has(spec.imported) && !targetInfo.named.has('*')) {
        problems.push(
          `НЕТ ЭКСПОРТА ${file.replace(ROOT, '.')}:${entry.line} — "${spec.imported}" отсутствует в "${entry.source}"`
        );
      }
    }
  }
}

console.log(`Файлов разобрано: ${modules.size}`);
if (problems.length) {
  console.log(`\nНайдено проблем: ${problems.length}`);
  for (const problem of problems) console.log('  · ' + problem);
  process.exit(1);
}
console.log('Синтаксис и импорты в порядке.');
