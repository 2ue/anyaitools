export {}

declare global {
  interface Window {
    electronAPI: any
  }
}

declare module '*.svg?react' {
  import React from 'react'
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default SVGComponent
}

declare module '@lobehub/icons-static-svg/icons/claude.svg?react' {
  import React from 'react'
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default SVGComponent
}

declare module '@lobehub/icons-static-svg/icons/openai.svg?react' {
  import React from 'react'
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default SVGComponent
}

declare module '@lobehub/icons-static-svg/icons/gemini.svg?react' {
  import React from 'react'
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default SVGComponent
}

declare module '@lobehub/icons-static-svg/icons/mcp.svg?react' {
  import React from 'react'
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default SVGComponent
}

declare module '@lobehub/icons-static-svg/icons/opencode.svg?react' {
  import React from 'react'
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default SVGComponent
}

declare module '@lobehub/icons-static-svg/icons/openclaw.svg?react' {
  import React from 'react'
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default SVGComponent
}

declare module '@lobehub/icons-static-svg/icons/grok.svg?react' {
  import React from 'react'
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default SVGComponent
}
