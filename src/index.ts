import { decorateWithTemplateLanguageService } from 'typescript-template-language-service-decorator'
import type * as ts from 'typescript/lib/tsserverlibrary'
import type { Declaration, LanguageService, SourceFile, TypeChecker } from 'typescript/lib/tsserverlibrary'
import { SymbolFlags } from 'typescript/lib/tsserverlibrary'
import { name } from '../package.json'

const all = Symbol()

export interface PluginOptions {
  name: 'ts-force-deprecation'

  /**
   * List of deprecations to enforce.
   *
   * If a string is provided, it will deprecate the entire module.
   * If an object is provided, it will deprecate the target within the module.
   */
  deprecations?: (string | DeprecationSet)[]
}

export interface DeprecationSet {
  /**
   * Module to deprecate.
   */
  module: string

  /**
   * List of targets to deprecate within the module.
   */
  target: (string | Deprecation)[]
}

export interface Deprecation {
  /**
   * Name of the target to deprecate.
   */
  name: string

  /**
   * Message to display when the target is used.
   */
  message: string
}

interface DeprecateTarget {
  module: string
  targetName: string | typeof all
  message: string
}

function defineTypeScriptPlugin<T extends TypeScriptPluginInitializer>(init: T): T {
  return init
}

type TypeScriptPluginInitializer = (mod: { typescript: typeof ts }) => TypeScriptPlugin

interface TypeScriptPlugin {
  create(info: ts.server.PluginCreateInfo): LanguageService
}

function configToTargets(option: PluginOptions): DeprecateTarget[] {
  const deprecations: DeprecateTarget[] = []
  for (const deprecationSet of option.deprecations ?? []) {
    if (typeof deprecationSet === 'string') {
      deprecations.push({ module: deprecationSet, targetName: all, message: `${deprecationSet} is deprecated` })
      continue
    }

    for (const target of deprecationSet.target) {
      if (typeof target === 'string') {
        deprecations.push({
          module: deprecationSet.module,
          targetName: target,
          message: `${target} is deprecated`,
        })
      } else {
        deprecations.push({ module: deprecationSet.module, targetName: target.name, message: target.message })
      }
    }
  }
  return deprecations
}

function findImportedSymbol(
  checker: TypeChecker,
  context: SourceFile,
  module: string,
  target: string | typeof all,
): Declaration[] | undefined {
  const symbol = checker.getSymbolsInScope(context, SymbolFlags.Module)
  const importSymbol = symbol.find((s) => s.name === module)
  if (!importSymbol?.declarations?.[0]) {
    return
  }

  const moduleSymbol = checker.getSymbolAtLocation(importSymbol.declarations[0])
  if (!moduleSymbol) {
    return
  }

  if (target === all) {
    return moduleSymbol.declarations
  }

  const targetSymbol = checker.getExportsOfModule(moduleSymbol).find((s) => s.name === target)
  return targetSymbol?.declarations?.[0] ? [targetSymbol.declarations[0]] : undefined
}

// biome-ignore lint/style/noDefaultExport: <explanation>
export default defineTypeScriptPlugin((mod) => ({
  create(info) {
    return decorateWithTemplateLanguageService(
      mod.typescript,
      info.languageService,
      info.project,
      {
        getSemanticDiagnostics(context) {
          const diagnostics = info.languageService.getSemanticDiagnostics(context.fileName)
          const sourceFile = info.languageService.getProgram()?.getSourceFile(context.fileName)
          const program = info.languageService.getProgram()

          if (!(sourceFile && program)) {
            return diagnostics
          }

          const checker = program.getTypeChecker()
          const deprecations = configToTargets(info.config.options as PluginOptions)

          for (const { module, targetName, message } of deprecations) {
            const declarations = findImportedSymbol(checker, sourceFile, module, targetName) ?? []

            for (const declaration of declarations) {
              diagnostics.push({
                file: sourceFile,
                reportsDeprecated: true,
                start: declaration.getStart(),
                length: declaration.getEnd() - declaration.getStart(),
                messageText: message,
                category: mod.typescript.DiagnosticCategory.Message,
                code: 9999,
              })
            }
          }

          return diagnostics
        },
      },
      {
        tags: [name],
      },
    )
  },
}))
