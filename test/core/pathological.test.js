'use strict'

const { describe, it } = require('node:test')
const assert = require('assert')
const yaml = require('js-yaml')

function assertYamlException (fn, pattern) {
  try {
    fn()
  } catch (error) {
    assert(
      error instanceof yaml.YAMLException,
      `expected YAMLException, got ${error.name}`
    )
    if (pattern) assert.match(error.message, pattern)
    return
  }

  assert.fail('expected YAMLException')
}

function createMergeChain (count) {
  const lines = ['a0: &a0 { k0: 0 }']

  for (let i = 1; i < count; i++) {
    lines.push(`a${i}: &a${i} { <<: *a${i - 1}, k${i}: ${i} }`)
  }

  lines.push(`b: *a${count - 1}`)
  return `${lines.join('\n')}\n`
}

describe('Pathological tests', function () {
  describe('Deep nesting', function () {
    it('throws YAMLException on deep array nesting (not stack overflow error)', function () {
      assertYamlException(function () { yaml.load('['.repeat(100000)) },
        /nesting exceeded maxDepth/)
    })

    it('throws YAMLException on deep object nesting (not stack overflow error)', function () {
      assertYamlException(function () { yaml.load('{a: '.repeat(100000)) },
        /nesting exceeded maxDepth/)
    })
  })

  describe('Merge aliases', function () {
    it('throws YAMLException when merge chain exceeds maxTotalMergeKeys', function () {
      assertYamlException(function () {
        yaml.load(createMergeChain(100000))
      }, /merge keys exceeded maxTotalMergeKeys/)
    })

    it('throws YAMLException on a long sequence of empty merge sources', function () {
      const n = 20000
      const src = 'arr: &arr [' + '{},'.repeat(n).slice(0, -1) + ']\n' +
        'targets:\n' + '  - <<: *arr\n'.repeat(n)
      assertYamlException(function () { yaml.load(src) }, /abnormal merge sequence size/)
    })

    it('counts empty merge sources against maxTotalMergeKeys', function () {
      const src = 'arr: &arr [' + '{},'.repeat(100).slice(0, -1) + ']\n' +
        'targets:\n' + '  - <<: *arr\n'.repeat(200)
      assertYamlException(function () { yaml.load(src) }, /merge keys exceeded maxTotalMergeKeys/)
    })
  })
})
