import React, { useEffect, useImperativeHandle, useRef } from "react"
import { LinkNode } from "@lexical/link"
import { ListItemNode, ListNode } from "@lexical/list"
import { MarkNode } from "@lexical/mark"
import { $convertToMarkdownString } from "@lexical/markdown"
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin"
import {
  InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { Message } from "ai/react"
import { $getRoot } from "lexical"

import { ITreeNode } from "@/lib/store/ITreeNode"
import { MentionNode } from "@/components/doc/nodes/MentionNode"
import NewMentionsPlugin, {
  MentionPluginProps,
} from "@/components/doc/plugins/MentionsPlugin"
import { allTransformers } from "@/components/doc/plugins/const"

const theme = {
  // Theme styling goes here
}

interface InputEditorProps {
  disabled?: boolean
  append: (message: Message) => void
  isLoading?: boolean
  setContextNodes?: (nodes: ITreeNode[]) => void
}

export const nodeInfoMap = new Map<string, ITreeNode>()

const AIInputEditorDataPlugin = React.forwardRef((props, ref) => {
  const [editor] = useLexicalComposerContext()

  useImperativeHandle(ref, () => ({
    getData: () => {
      return editor.getEditorState().read(() => {
        const markdown = $convertToMarkdownString(allTransformers)
        console.log("useImperativeHandle", markdown)
        return markdown
      })
    },
    clear: () => {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
      })
    },
  }))
  return null
})

export const AIInputEditor = ({
  disabled,
  append,
  isLoading,
  setContextNodes,
}: InputEditorProps) => {
  const initialConfig: InitialConfigType = {
    namespace: "AI-Chat-Input-Editor",
    theme,
    onError: console.error,
    editable: !disabled,
    nodes: [
      MarkNode,
      HeadingNode,
      QuoteNode,
      LinkNode,
      ListNode,
      ListItemNode,
      MentionNode,
    ],
  }
  const dataPluginRef = useRef<{
    getData: () => string
    clear: () => void
  }>(null)

  useEffect(() => {
    return () => {
      nodeInfoMap.clear()
    }
  }, [])

  const handleEnterPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      const contextMenu = document.querySelector("#typeahead-menu")
      if (contextMenu?.hasChildNodes()) {
        return
      }
      if (e.shiftKey) return
      e.preventDefault()
      e.stopPropagation()
      if (isLoading) {
        return
      }
      const markdown = dataPluginRef.current?.getData()
      markdown &&
        append({
          id: crypto.randomUUID(),
          role: "user",
          content: markdown,
        })
      dataPluginRef.current?.clear()
    }
  }

  const handleNodeInsert: MentionPluginProps["onOptionSelectCallback"] = (
    option
  ) => {
    const node = option.rawData
    nodeInfoMap.set(node.id, node)
    setContextNodes?.([...nodeInfoMap.values()])
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className=" relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className=" h-auto min-h-[100px] rounded-sm border-none bg-gray-100 p-2 outline-none dark:bg-gray-800"
              onKeyDownCapture={handleEnterPress}
            />
          }
          placeholder={
            <div className=" pointer-events-none absolute left-3 top-2">
              Type your message here.
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <NewMentionsPlugin onOptionSelectCallback={handleNodeInsert} />
      <HistoryPlugin />
      <AutoFocusPlugin />
      <AIInputEditorDataPlugin ref={dataPluginRef} />
    </LexicalComposer>
  )
}