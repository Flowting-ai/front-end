import { describe, expect, it } from 'vitest'
import { buildTurnOptions, getFolderPinIds, type TurnSettings } from './turn-options'

const SETTINGS: TurnSettings = {
  webSearch:              true,
  reasoningEffort:        'high',
  algorithm:              null,
  personaId:              'ver-1',
  systemPrompt:           'Be terse.',
  temperature:            0.3,
  toneId:                 'professional',
  connectorSlugs:         ['gmail'],
  chatOwnershipConfirmed: true,
  pinsEnabled:            true,
  folderPinIds:           ['pin-a', 'pin-b'],
}

describe('buildTurnOptions', () => {
  it('carries every composer setting', () => {
    expect(buildTurnOptions(SETTINGS)).toEqual({
      webSearch:              true,
      enableReasoning:        true,
      reasoningEffort:        'high',
      algorithm:              null,
      files:                  undefined,
      userMessageId:          undefined,
      pinIds:                 ['pin-a', 'pin-b'],
      personaId:              'ver-1',
      systemPrompt:           'Be terse.',
      temperature:            0.3,
      toneId:                 'professional',
      connectorSlugs:         ['gmail'],
      chatOwnershipConfirmed: true,
      onUploadProgress:       undefined,
    })
  })

  it('gives a regenerate the same options as the send, minus the files', () => {
    const file = new File(['x'], 'a.pdf')
    const onUploadProgress = () => {}
    const send = buildTurnOptions(SETTINGS, {
      files: [file], userMessageId: 'optimistic-user-1', mentionedPinIds: ['pin-c'], onUploadProgress,
    })
    const regenerate = buildTurnOptions(SETTINGS, { mentionedPinIds: ['pin-c'], replaceMessageId: 'turn-1' })

    expect(send.files).toEqual([file])
    expect(send.onUploadProgress).toBe(onUploadProgress)
    expect(regenerate.replaceMessageId).toBe('turn-1')
    expect({ ...regenerate, replaceMessageId: undefined })
      .toEqual({ ...send, files: undefined, userMessageId: undefined, onUploadProgress: undefined })
  })

  it('merges folder and mentioned pins without duplicates', () => {
    expect(buildTurnOptions(SETTINGS, { mentionedPinIds: ['pin-b', 'pin-c'] }).pinIds).toEqual(['pin-a', 'pin-b', 'pin-c'])
  })

  it('sends no pins when pins are switched off', () => {
    expect(buildTurnOptions({ ...SETTINGS, pinsEnabled: false }, { mentionedPinIds: ['pin-c'] }).pinIds).toBeUndefined()
  })

  it('maps thinking effort to enableReasoning: null is off, undefined sends nothing', () => {
    expect(buildTurnOptions({ ...SETTINGS, reasoningEffort: null }).enableReasoning).toBe(false)
    expect(buildTurnOptions({ ...SETTINGS, reasoningEffort: undefined }).enableReasoning).toBeUndefined()
  })

  it('omits empty and null settings', () => {
    const options = buildTurnOptions({
      pinsEnabled: true, personaId: null, systemPrompt: null, temperature: null, toneId: null, connectorSlugs: [],
    }, { files: [], onUploadProgress: () => {} })
    expect(options.personaId).toBeUndefined()
    expect(options.systemPrompt).toBeUndefined()
    expect(options.temperature).toBeUndefined()
    expect(options.toneId).toBeUndefined()
    expect(options.connectorSlugs).toBeUndefined()
    expect(options.pinIds).toBeUndefined()
    expect(options.files).toBeUndefined()
    expect(options.onUploadProgress).toBeUndefined()
    expect('replaceMessageId' in options).toBe(false)
  })
})

describe('getFolderPinIds', () => {
  const pins = [{ id: 'p1', folderId: 'f1' }, { id: 'p2', folderId: 'f2' }, { id: 'p3' }]

  it('picks the pins in the selected folders', () => {
    expect(getFolderPinIds(pins, [{ id: 'f2' }])).toEqual(['p2'])
  })

  it('gives nothing without selected folders', () => {
    expect(getFolderPinIds(pins, undefined)).toEqual([])
    expect(getFolderPinIds(pins, [])).toEqual([])
  })
})
