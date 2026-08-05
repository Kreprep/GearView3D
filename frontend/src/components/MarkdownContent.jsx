import ReactMarkdown from 'react-markdown'
import './MarkdownContent.css'

/**
 * Renders admin-authored markdown (part descriptions, lesson blurbs).
 * Supports standard markdown: headings, bold/italic, bullet and numbered
 * lists, links, inline code, and images placed anywhere in the text via
 * `![alt](/images/example.png)`.
 */
function MarkdownContent({ children, className = '' }) {
  if (!children) return null

  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}

export default MarkdownContent
