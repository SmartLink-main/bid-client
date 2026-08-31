import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const sourcePath = path.join(projectRoot, 'src', 'lib', 'knowledge-forms.ts')
const publicFormsPath = path.join(projectRoot, 'public', 'forms')
const source = await readFile(sourcePath, 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`
const { auctionForms, getAuctionFormDownloadHref } = await import(moduleUrl)
const actualFiles = new Set(
  (await readdir(publicFormsPath)).filter((fileName) => /\.(?:hwp|doc)$/i.test(fileName)),
)
const referencedFiles = new Set()
const errors = []

if (auctionForms.length !== 61) {
  errors.push(`서식 수가 61개가 아닙니다: ${auctionForms.length}개`)
}

for (const auctionForm of auctionForms) {
  for (const fileType of ['hwp', 'doc']) {
    const href = getAuctionFormDownloadHref(auctionForm, fileType)
    const fileName = decodeURIComponent(href.slice('/forms/'.length))
    if (referencedFiles.has(fileName)) {
      errors.push(`중복 파일 매핑: ${fileName}`)
    }
    referencedFiles.add(fileName)
    if (!actualFiles.has(fileName)) {
      errors.push(`실제 파일 없음: ${auctionForm.title} [${fileType}] -> ${fileName}`)
    }
  }
}

for (const fileName of actualFiles) {
  if (!referencedFiles.has(fileName)) {
    errors.push(`화면에 연결되지 않은 파일: ${fileName}`)
  }
}

if (referencedFiles.size !== 122) {
  errors.push(`고유 다운로드 파일 수가 122개가 아닙니다: ${referencedFiles.size}개`)
}

if (errors.length > 0) {
  throw new Error(`경매서식 매핑 검증 실패\n${errors.join('\n')}`)
}

console.log(`경매서식 ${auctionForms.length}개, 다운로드 파일 ${referencedFiles.size}개 매핑 확인`)
