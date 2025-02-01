import fs from 'node:fs';
import path from 'node:path';

// anchor, common, tab をそれぞれ named import で読み込む想定
// （同階層にある前提で相対パスを指定しています。必要に応じて変更）
import { base } from '../base/index.js';


/**
 * 指定ディレクトリ以下を再帰的に探索し、
 * ファイル名が "config.js" のパスをすべて返す。
 *
 * @param {string} dirPath - 探索開始ディレクトリのパス
 * @returns {string[]}      - 発見した config.js の絶対パス一覧
 */
function findAllConfigJs(dirPath) {
  const result = [];

  // ディレクトリ内のエントリを取得
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // 再帰的に探索
      result.push(...findAllConfigJs(entryPath));
    } else if (entry.isFile() && entry.name === 'config.js') {
      // config.js を発見
      result.push(entryPath);
    }
  }

  return result;
}

/**
 * 日時文字列(YYYYMMDD-HHmmss)を返す。例: "20250203-141530"
 */
function getDateTimeString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * もしルート直下に mint.json があれば bk フォルダ内に
 * "_mint-YYYYMMDD-HHmmss.json" という形式でバックアップする。
 */
function backupExistingMintJson() {
  const currentOutputPath = path.resolve('mint.json');
  if (!fs.existsSync(currentOutputPath)) {
    return; // 既存のファイルがなければ何もしない
  }

  const backupDir = path.resolve('bk');
  fs.mkdirSync(backupDir, { recursive: true });

  const backupFilename = `_mint-${getDateTimeString()}.json`;
  const backupPath = path.join(backupDir, backupFilename);

  fs.renameSync(currentOutputPath, backupPath);
  console.log(`既存の mint.json を ${backupPath} に移動しました。`);
}

async function main() {
  // まずは ./ ディレクトリ以下にある config.js を再帰的に探す
  const baseDir = path.resolve('.');
  const configPaths = findAllConfigJs(baseDir);

  console.log('=== 発見した config.js 一覧 ===');
  for (const p of configPaths) {
    console.log(' -', p);
  }

  // 各 config.js が持つ navigation をまとめる配列
  const allNavigations = [];

  for (const configPath of configPaths) {
    // 動的インポート (ESMモジュール) は非同期
    const mod = await import(configPath);

    // config.js 側で export default {} を想定
    if (mod.default) {
      allNavigations.push(mod.default);
    }
  }

  // 既存 mint.json があればバックアップ
  backupExistingMintJson();

  // "anchor.js", "common.js", "tab.js" で読み込んだオブジェクトをまとめ、
  // "navigation" には各 config.js から収集した配列をセット
  const finalObject = {
    ...base,
    navigation: allNavigations,
  };

  // これを JSON 形式の文字列にし、mint.json に書き出す
  fs.writeFileSync(
    path.resolve('mint.json'),           // 出力ファイル名
    JSON.stringify(finalObject, null, 2), // 整形して書き込む
    'utf-8'
  );

  console.log('---');
  console.log(`mint.json を生成しました (navigation: ${allNavigations.length}項目)。`);
}

await main();
