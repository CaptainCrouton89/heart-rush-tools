declare module 'node-pandoc' {
  type PandocCallback = (err: Error | null, result?: string) => void;
  
  function nodePandoc(
    src: string,
    args: string[],
    callback: PandocCallback
  ): void;
  
  export = nodePandoc;
}