type AndroidBackHandler = () => boolean;

// React 页面中的抽屉/弹窗按打开顺序注册返回处理器，系统返回时从最上层开始关闭。
const handlers: AndroidBackHandler[] = [];

export function registerAndroidBackHandler(handler: AndroidBackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

export function handleAndroidBack(): boolean {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index]()) return true;
  }
  return false;
}
