import test from 'node:test'
import assert from 'node:assert/strict'
import { isSafeFilename } from '../src/shared/filename'

test('isSafeFilename accepts a plain UUID-style filename', () => {
  assert.equal(isSafeFilename('550e8400-e29b-41d4-a716-446655440000.png'), true)
})

test('isSafeFilename rejects empty string', () => {
  assert.equal(isSafeFilename(''), false)
})

test('isSafeFilename rejects filenames containing a null byte', () => {
  assert.equal(isSafeFilename('foo\0.png'), false)
  assert.equal(isSafeFilename('\0'), false)
})

test('isSafeFilename rejects path traversal with ..', () => {
  assert.equal(isSafeFilename('..'), false)
  assert.equal(isSafeFilename('../etc/passwd'), false)
  assert.equal(isSafeFilename('foo..bar'), false)
})

test('isSafeFilename rejects forward and backward slashes', () => {
  assert.equal(isSafeFilename('a/b.png'), false)
  assert.equal(isSafeFilename('a\\b.png'), false)
  assert.equal(isSafeFilename('/abs.png'), false)
})
