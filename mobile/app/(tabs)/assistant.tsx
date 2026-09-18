import { useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api } from '../../src/api/client'
import { colors } from '../../src/theme'

type Message = { id: string; role: 'assistant' | 'user'; text: string }
const welcome: Message = { id: 'welcome', role: 'assistant', text: 'Hola, soy tu asistente Vokter. Puedo ayudarte a encontrar productos, resolver dudas sobre envíos o recomendarte un look.' }

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [prompt, setPrompt] = useState('')
  const [sending, setSending] = useState(false)
  const list = useRef<FlatList<Message>>(null)
  const send = async () => {
    const text = prompt.trim()
    if (!text || sending) return
    const userMessage = { id: `user-${Date.now()}`, role: 'user' as const, text }
    setPrompt(''); setMessages((current) => [...current, userMessage]); setSending(true)
    try {
      const result = await api.askAssistant(text)
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: result.response ?? 'No pude preparar una respuesta. Inténtalo de nuevo.' }])
    } catch {
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', text: 'No pude conectar con el asistente en este momento. Inténtalo nuevamente.' }])
    } finally { setSending(false) }
  }
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page} keyboardVerticalOffset={90}>
    <FlatList ref={list} data={messages} keyExtractor={(message) => message.id} contentContainerStyle={styles.list} onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
      ListHeaderComponent={<View style={styles.intro}><Text style={styles.eyebrow}>Asistente IA</Text><Text style={styles.title}>Compra con una recomendación que entiende lo que buscas.</Text></View>}
      renderItem={({ item }) => <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>{item.text}</Text></View>}
      ListFooterComponent={sending ? <Text style={styles.thinking}>El asistente está pensando…</Text> : null} />
    <View style={styles.composer}><TextInput value={prompt} onChangeText={setPrompt} onSubmitEditing={send} placeholder="Escribe tu pregunta…" multiline style={styles.input} /><Pressable onPress={send} style={[styles.send, (!prompt.trim() || sending) && styles.inactive]}><Text style={styles.sendText}>Enviar</Text></Pressable></View>
  </KeyboardAvoidingView>
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.white }, list: { padding: 16, gap: 10 }, intro: { paddingBottom: 12, gap: 8 }, eyebrow: { color: colors.accent, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 11 }, title: { color: colors.ink, fontWeight: '800', fontSize: 23, lineHeight: 29 }, bubble: { maxWidth: '86%', padding: 13, borderRadius: 3 }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.black }, bubbleText: { color: colors.ink, lineHeight: 21 }, userText: { color: colors.white }, thinking: { color: colors.muted, paddingVertical: 8, fontStyle: 'italic' }, composer: { borderTopWidth: 1, borderColor: colors.line, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-end' }, input: { flex: 1, maxHeight: 110, borderWidth: 1, borderColor: colors.line, padding: 12, color: colors.ink }, send: { backgroundColor: colors.black, paddingHorizontal: 14, paddingVertical: 13 }, inactive: { opacity: 0.45 }, sendText: { color: colors.white, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' } })
