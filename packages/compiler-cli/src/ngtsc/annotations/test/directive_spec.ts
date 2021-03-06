/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {ReferenceEmitter} from '../../imports';
import {PartialEvaluator} from '../../partial_evaluator';
import {TypeScriptReflectionHost} from '../../reflection';
import {getDeclaration, makeProgram} from '../../testing/in_memory_typescript';
import {DirectiveDecoratorHandler} from '../src/directive';
import {SelectorScopeRegistry} from '../src/selector_scope';


describe('DirectiveDecoratorHandler', () => {
  it('should use the `ReflectionHost` to detect class inheritance', () => {
    const {program, options, host} = makeProgram([
      {
        name: 'node_modules/@angular/core/index.d.ts',
        contents: 'export const Directive: any;',
      },
      {
        name: 'entry.ts',
        contents: `
          import {Directive} from '@angular/core';

          @Directive({selector: 'test-dir-1'})
          export class TestDir1 {}

          @Directive({selector: 'test-dir-2'})
          export class TestDir2 {}
        `,
      },
    ]);

    const checker = program.getTypeChecker();
    const reflectionHost = new TestReflectionHost(checker);
    const evaluator = new PartialEvaluator(reflectionHost, checker);
    const handler = new DirectiveDecoratorHandler(
        reflectionHost, evaluator,
        new SelectorScopeRegistry(checker, reflectionHost, new ReferenceEmitter([])), false);

    const analyzeDirective = (dirName: string) => {
      const DirNode = getDeclaration(program, 'entry.ts', dirName, ts.isClassDeclaration);

      const detected = handler.detect(DirNode, reflectionHost.getDecoratorsOfDeclaration(DirNode));
      if (detected === undefined) {
        throw new Error(`Failed to recognize @Directive (${dirName}).`);
      }

      const {analysis} = handler.analyze(DirNode, detected.metadata);
      if (analysis === undefined) {
        throw new Error(`Failed to analyze @Directive (${dirName}).`);
      }

      return analysis;
    };

    // By default, `TestReflectionHost#hasBaseClass()` returns `false`.
    const analysis1 = analyzeDirective('TestDir1');
    expect(analysis1.meta.usesInheritance).toBe(false);

    // Tweak `TestReflectionHost#hasBaseClass()` to return true.
    reflectionHost.hasBaseClassReturnValue = true;

    const analysis2 = analyzeDirective('TestDir2');
    expect(analysis2.meta.usesInheritance).toBe(true);
  });
});

// Helpers
class TestReflectionHost extends TypeScriptReflectionHost {
  hasBaseClassReturnValue = false;

  hasBaseClass(node: ts.Declaration): boolean { return this.hasBaseClassReturnValue; }
}
