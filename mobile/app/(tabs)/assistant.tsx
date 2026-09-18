import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import { colors } from '../../src/theme'

type Message = { id: string; role: 'assistant' | 'user'; text: string }
const welcome: Message = { id: 'welcome', role: 'assistant', text: 'Hola, soy tu asistente Vokter. Puedo ayudarte a encontrar productos, resolver dudas sobre envíos o recomendarte un look.' }
const FALLBACK_RESPONSE = 'No pude preparar una respuesta en este momento. Inténtalo nuevamente.'

function productSlugFromLink(href: string): string | null {
  try {
    const path = new URL(href, 'https://vokter.local').pathname
    const match = path.match(/^\/products\/([^/]+)$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function AssistantText({ text, onProductPress }: { text: string; onProductPress: (slug: string) => void }) {
  const lines = text.split('\n')
  return <View style={styles.assistantText}>
    {lines.map((line, lineIndex) => {
      const normalizedLine = line.replace(/^\s*[-*•]\s+/, '• ')
      const tokens = normalizedLine.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/)
      const content: ReactNode[] = tokens.map((token, tokenIndex) => {
        if (token.startsWith('**') && token.endsWith('**')) {
          return <Text key={tokenIndex} style={styles.bold}>{token.slice(2, -2)}</Text>
        }
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (!link) return <Text key={tokenIndex}>{token}</Text>
        const [, label, href] = link
        const slug = productSlugFromLink(href)
        return slug
          ? <Text key={tokenIndex} onPress={() => onProductPress(slug)} style={styles.link}>{label}</Text>
          : <Text key={tokenIndex}>{label}</Text>
      })
      return <Text key={lineIndex} style={styles.bubbleText}>{content}</Text>
    })}
  </View>
}

export default function AssistantScreen() {
  const router = useRouter()
  const { initialPrompt } = useLocalSearchParams<{ initialPrompt?: string }>()
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [prompt, setPrompt] = useState('')
  const [sending, setSending] = useState(false)
  const list = useRef<FlatList<Message>>(null)
  const lastAutoPrompt = useRef<string | null>(null)
  const send = async (nextPrompt?: string) => {
    const text = (nextPrompt ?? prompt).trim()
    if (!text || sending) return
    const messageId = `${Date.now()}`
    const userMessage = { id: `user-${messageId}`, role: 'user' as const, text }
    setPrompt('')
    setMessages((current) => [...current, userMessage])
    setSending(true)
    try {
      const result = await api.askAssistant(text)
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${messageId}`,
          role: 'assistant',
          text: result.response || FALLBACK_RESPONSE,
        },
      ])
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'No pude conectar con el asistente en este momento. Inténtalo nuevamente.'
      setMessages((current) => [...current, { id: `error-${messageId}`, role: 'assistant', text: message }])
    } finally { setSending(false) }
  }
  useEffect(() => {
    if (!initialPrompt || initialPrompt === lastAutoPrompt.current) return
    lastAutoPrompt.current = initialPrompt
    setPrompt(initialPrompt)
    void send(initialPrompt)
  }, [initialPrompt])
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page} keyboardVerticalOffset={90}>
    <FlatList ref={list} data={messages} keyExtractor={(message) => message.id} contentContainerStyle={styles.list} onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
      ListHeaderComponent={<View style={styles.intro}><Text style={styles.eyebrow}>Asistente IA</Text><Text style={styles.title}>Compra con una recomendación que entiende lo que buscas.</Text></View>}
      renderItem={({ item }) => <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>{item.role === 'user' ? <Text style={[styles.bubbleText, styles.userText]}>{item.text}</Text> : <AssistantText text={item.text} onProductPress={(slug) => router.push(`/product/${slug}`)} />}</View>}
      ListFooterComponent={sending ? <Text style={styles.thinking}>El asistente está pensando…</Text> : null} />
    <View style={styles.composer}><TextInput value={prompt} onChangeText={setPrompt} onSubmitEditing={() => void send()} placeholder="Escribe tu pregunta…" multiline editable={!sending} style={styles.input} /><Pressable disabled={sending || !prompt.trim()} onPress={() => void send()} style={[styles.send, (!prompt.trim() || sending) && styles.inactive]}><Text style={styles.sendText}>Enviar</Text></Pressable></View>
  </KeyboardAvoidingView>
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.white }, list: { padding: 16, gap: 10 }, intro: { paddingBottom: 12, gap: 8 }, eyebrow: { color: colors.accent, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 11 }, title: { color: colors.ink, fontWeight: '800', fontSize: 23, lineHeight: 29 }, bubble: { maxWidth: '86%', padding: 13, borderRadius: 3 }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.black }, assistantText: { gap: 4 }, bubbleText: { color: colors.ink, lineHeight: 21 }, bold: { fontWeight: '800' }, link: { color: colors.ink, textDecorationLine: 'underline', fontWeight: '700' }, userText: { color: colors.white }, thinking: { color: colors.muted, paddingVertical: 8, fontStyle: 'italic' }, composer: { borderTopWidth: 1, borderColor: colors.line, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-end' }, input: { flex: 1, maxHeight: 110, borderWidth: 1, borderColor: colors.line, padding: 12, color: colors.ink }, send: { backgroundColor: colors.black, paddingHorizontal: 14, paddingVertical: 13 }, inactive: { opacity: 0.45 }, sendText: { color: colors.white, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' } })
