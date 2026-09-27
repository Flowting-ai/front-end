'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDownOneIcon, PlusSignIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { ModelIcon } from '@/components/ModelIcon'
import { getSlackAppConfig, updateSlackAppConfig, uploadSlackSkill } from '@/lib/api/slack'
import { fetchModelsWithCache, sortModels } from '@/lib/ai-models'
import { stableKey } from '@/hooks/use-model-selection'
import type { SlackAppConfig } from '@/lib/api/slack'
import type { AIModel } from '@/types/ai-model'
import styles from './slack-config.module.css'

export function SlackAppPanel({ orgId }: { orgId: string }) {
  const [config, setConfig] = useState<SlackAppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [models, setModels] = useState<AIModel[]>([])
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const [uploadingSkill, setUploadingSkill] = useState(false)
  const lastSavedConfig = useRef<string | null>(null)
  const saveSequence = useRef(0)
  const skillInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSlackAppConfig(orgId), fetchModelsWithCache()])
      .then(([next, catalog]) => {
        if (!cancelled) {
          lastSavedConfig.current = JSON.stringify({
            prompt: next.prompt,
            modelId: next.modelId,
            skills: next.skills,
          })
          setConfig(next)
          setModels(sortModels(catalog.filter(model => !model.blocked)))
        }
      })
      .catch(err => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load Slack instructions')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId])

  useEffect(() => {
    if (!config) return

    const payload = {
      prompt: config.prompt,
      modelId: config.modelId,
      skills: config.skills,
    }
    const serialized = JSON.stringify(payload)
    if (serialized === lastSavedConfig.current) return

    const sequence = ++saveSequence.current
    const timeout = window.setTimeout(() => {
      void updateSlackAppConfig(orgId, payload)
        .then(() => {
          if (sequence === saveSequence.current) lastSavedConfig.current = serialized
        })
        .catch(err => {
          if (sequence === saveSequence.current) {
            toast.error(err instanceof Error ? err.message : 'Failed to save Slack defaults')
          }
        })
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [config, orgId])

  if (loading || !config) return <div className={`kaya-skeleton ${styles.skeleton}`} />

  const selectedModel = config.modelId
    ? models.find(model => stableKey(model) === config.modelId) ?? null
    : null
  const selectedModelLabel = config.modelId && !selectedModel
    ? 'Current model (unavailable)'
    : selectedModel?.modelName ?? 'Automatic (recommended)'
  const selectedModelProvider = selectedModel?.companyName ?? null

  const availableSkillsByName = new Map(config.availableSkills.map(skill => [skill.name, skill]))
  const selectedSkillNames = new Set(config.skills)
  const selectedSkills = config.skills.map(name => (
    availableSkillsByName.get(name) ?? { name, description: 'Enabled for Slack requests.' }
  ))
  const skillsToAdd = config.availableSkills.filter(skill => !selectedSkillNames.has(skill.name))

  const addSkill = (name: string) => {
    if (selectedSkillNames.has(name)) return
    setConfig({ ...config, skills: [...config.skills, name] })
    setSkillMenuOpen(false)
  }

  const removeSkill = (name: string) => {
    setConfig({ ...config, skills: config.skills.filter(skill => skill !== name) })
  }

  const handleSkillUpload = (file: File | undefined) => {
    if (!file || uploadingSkill) return
    if (!file.name.toLowerCase().endsWith('.md')) {
      toast.error('Choose a Markdown (.md) skill file')
      return
    }
    setUploadingSkill(true)
    void uploadSlackSkill(orgId, file)
      .then(next => {
        lastSavedConfig.current = JSON.stringify({
          prompt: next.prompt,
          modelId: next.modelId,
          skills: next.skills,
        })
        setConfig(next)
        toast.success(`${file.name} uploaded and enabled`)
      })
      .catch(err => {
        toast.error(err instanceof Error ? err.message : 'Failed to upload skill')
      })
      .finally(() => {
        setUploadingSkill(false)
        if (skillInputRef.current) skillInputRef.current.value = ''
      })
  }

  return (
    <div>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionCopy}>
            <h3 className={styles.sectionTitle}>Custom instructions</h3>
            <p className={styles.sectionDescription}>
              Guidance Souvenir follows across Slack. Channel instructions are applied after these defaults.
            </p>
          </div>
        </div>
        <textarea
          className={`${styles.field} ${styles.textarea}`}
          aria-label="Workspace Slack instructions"
          value={config.prompt}
          onChange={event => setConfig({ ...config, prompt: event.target.value })}
          placeholder="How should Souvenir behave and respond in Slack?"
          rows={6}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionCopy}>
            <h3 className={styles.sectionTitle}>Model</h3>
            <p className={styles.sectionDescription}>
              Choose the model used for replies and work started from Slack.
            </p>
          </div>
        </div>
        <div className={styles.modelPicker}>
          <Dropdown.Float
            open={modelMenuOpen}
            onOpenChange={setModelMenuOpen}
            placement="bottom-start"
            autoFlipVertical
            trigger={
              <button className={styles.modelSelectTrigger} type="button" aria-label="Slack model">
                <span className={styles.modelSelectIdentity}>
                  <ModelIcon model={selectedModelProvider} size={18} />
                  <span className={styles.modelSelectCopy}>
                    <span className={styles.modelSelectLabel}>{selectedModelLabel}</span>
                    {selectedModelProvider && <span className={styles.modelSelectProvider}>{selectedModelProvider}</span>}
                  </span>
                </span>
                <ArrowDownOneIcon size={16} className={styles.modelSelectChevron} />
              </button>
            }
          >
            <Dropdown size="xl">
              <Dropdown.Section label="Model" fluid>
                <Dropdown.Item
                  fluid
                  icon={<ModelIcon size={16} />}
                  label="Automatic"
                  subLabel="Recommended · Souvenir chooses the best model"
                  selected={config.modelId === null}
                  rightIcon={<TickTwoIcon style={{ opacity: config.modelId === null ? 1 : 0 }} />}
                  onClick={() => {
                    setConfig({ ...config, modelId: null })
                    setModelMenuOpen(false)
                  }}
                />
                {config.modelId && !selectedModel && (
                  <Dropdown.Item
                    fluid
                    icon={<ModelIcon size={16} />}
                    label="Current model"
                    subLabel="Unavailable"
                    selected
                    disabled
                    rightIcon={<TickTwoIcon />}
                  />
                )}
                {models.map(model => {
                  const key = stableKey(model)
                  if (!key) return null
                  const selected = config.modelId === key
                  return (
                    <Dropdown.Item
                      key={key}
                      fluid
                      icon={<ModelIcon model={model.companyName || model.modelName} size={16} />}
                      label={model.modelName}
                      subLabel={model.companyName}
                      selected={selected}
                      rightIcon={<TickTwoIcon style={{ opacity: selected ? 1 : 0 }} />}
                      onClick={() => {
                        setConfig({ ...config, modelId: key })
                        setModelMenuOpen(false)
                      }}
                    />
                  )
                })}
              </Dropdown.Section>
            </Dropdown>
          </Dropdown.Float>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionCopy}>
            <h3 className={styles.sectionTitle}>Skills</h3>
            <p className={styles.sectionDescription}>
              Preload specialized guidance for every Slack request. Souvenir can still load other skills when needed.
            </p>
          </div>
          <Dropdown.Float
            open={skillMenuOpen}
            onOpenChange={setSkillMenuOpen}
            placement="bottom-end"
            autoFlipVertical
            trigger={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<PlusSignIcon size={16} />}
                loading={uploadingSkill}
              >
                Add skills
              </Button>
            }
          >
            <Dropdown size="lg" maxHeight={320}>
              <Dropdown.Section fluid>
                <Dropdown.Item
                  fluid
                  label="Upload .md file"
                  subLabel="Add a workspace skill and enable it for Slack"
                  icon={<PlusSignIcon size={16} />}
                  onClick={() => {
                    setSkillMenuOpen(false)
                    skillInputRef.current?.click()
                  }}
                />
              </Dropdown.Section>
              {skillsToAdd.length > 0 && (
                <Dropdown.Section label="Available skills" divider fluid>
                  {skillsToAdd.map(skill => (
                    <Dropdown.Item
                      key={skill.name}
                      fluid
                      label={skill.name}
                      subLabel={skill.description}
                      rightIcon={<PlusSignIcon size={16} />}
                      onClick={() => addSkill(skill.name)}
                    />
                  ))}
                </Dropdown.Section>
              )}
            </Dropdown>
          </Dropdown.Float>
          <input
            ref={skillInputRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            hidden
            onChange={event => handleSkillUpload(event.target.files?.[0])}
          />
        </div>
        {selectedSkills.length > 0 ? (
          <div className={styles.skillList}>
            {selectedSkills.map(skill => (
              <div className={styles.skillRow} key={skill.name}>
                <div className={styles.skillCopy}>
                  <span className={styles.skillName}>{skill.name}</span>
                  <span className={styles.skillDescription}>{skill.description}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeSkill(skill.name)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.skillEmpty}>
            <p className={styles.skillEmptyTitle}>
              {config.availableSkills.length > 0 ? 'No skills added' : 'No workspace skills available'}
            </p>
            <p className={styles.skillEmptyDescription}>
              {config.availableSkills.length > 0
                ? 'Add a skill to preload its guidance for every Slack request.'
                : 'Skills registered for this workspace will appear here.'}
            </p>
          </div>
        )}
      </section>

    </div>
  )
}
