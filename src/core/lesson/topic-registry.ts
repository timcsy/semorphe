import type { Topic } from '../types'

export class TopicRegistry {
  private topics = new Map<string, Topic>()
  private byLanguage = new Map<string, Topic[]>()

  register(topic: Topic): void {
    if (this.topics.has(topic.id)) {
      throw new Error(`Duplicate topic ID: ${topic.id}`)
    }

    const langTopics = this.byLanguage.get(topic.language) ?? []

    if (topic.default && langTopics.some((t) => t.default)) {
      throw new Error(
        `Language "${topic.language}" already has a default topic. Cannot register "${topic.id}" as default.`
      )
    }

    this.topics.set(topic.id, topic)
    langTopics.push(topic)
    this.byLanguage.set(topic.language, langTopics)
  }

  get(topicId: string): Topic | undefined {
    return this.topics.get(topicId)
  }

  getDefault(language: string): Topic | undefined {
    const langTopics = this.byLanguage.get(language)
    if (!langTopics || langTopics.length === 0) return undefined
    return langTopics.find((t) => t.default) ?? langTopics[0]
  }

  listForLanguage(language: string): Topic[] {
    return this.byLanguage.get(language) ?? []
  }
}
