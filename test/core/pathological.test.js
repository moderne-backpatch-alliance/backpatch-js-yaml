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
  describe('Ordered maps', function () {
    it('loads a large !!omap in linear time', function () {
      const n = 100000
      const src = '!!omap\n' + Array.from({ length: n }, (_, i) => `- k${i}: ${i}\n`).join('')
      const start = Date.now()
      const result = yaml.load(src)
      const elapsed = Date.now() - start

      assert.strictEqual(result.length, n)
      assert.deepStrictEqual(result[n - 1], { [`k${n - 1}`]: n - 1 })
      assert(elapsed < 2000, `loading ${n} omap pairs took ${elapsed}ms`)
    })

    it('still rejects duplicate keys in !!omap', function () {
      assertYamlException(function () {
        yaml.load('!!omap\n- a: 1\n- b: 2\n- a: 3\n')
      }, /cannot resolve a node with !<tag:yaml.org,2002:omap> explicit tag/)
    })
  })

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
