---
layout: post
title: "关于NIO的一些思考"
date: 2017-07-31 15:22
comments: true
categories: NIO
---

最近闲来无事在看js的回调和非阻塞编程的模型，java因为不能传递方法作为参数所以在做回调功能时，不如js这些动态语言方便，通常需要定义interface并传递一个interface的实现来做一些回调的实现。但是java也有非阻塞编程，比较常见的就是NIO了，也是经过实战验证的并且性能也不差。那用起来跟js又有哪些不一样呢？有js那种回调的方式来做处理来的方便吗？

Java NIO作为java程序员必备的技能，大家在工作中或多或少都会碰到，总是人云亦云地用着，可是为什么要用，什么情况下可以用，什么情况下必须用，好像大家都没有认真思考过。

* 特点 ：

IO        NIO
面向流    面向缓冲
阻塞IO    非阻塞IO
无        选择器

* 使用场景

如果需要管理同时打开的成千上万个连接，这些连接每次只是发送少量的数据，例如聊天服务器，实现NIO的服务器可能是一个优势。
如果你有少量的连接使用非常高的带宽，一次发送大量的数据，也许典型的IO服务器实现可能非常契合。

* 写法

本文主要讲网络IO，文件读写的Nio是不支持非阻塞的，不够典型，至于为什么不支持非阻塞，应该是底层实现那边觉得没有非阻塞的必要，我们从java代码来看这个问题:

```java
SocketChannel socketChannel = SocketChannel.open();
socketChannel.configureBlocking(false);
socketChannel.connect(new InetSocketAddress("http://www.tuniu.com", 80));

while(! socketChannel.finishConnect() ){
    //wait, or do something else...
}
```

这段代码是非阻塞模式下判断是否建立连接，因为是非阻塞，所以connnect方法是立即返回的，但是此时并不一定已经建立了连接，只能通过finishConnect方法来判断是否成功建立了连接。同样，如果是非阻塞状态，我们看下面这段代码：

```java
ByteBuffer buf = ByteBuffer.allocate(48);
int bytesRead = socketChannel.read(buf);
```

非阻塞模式下,read()方法在尚未读取到任何数据时可能就返回了。所以需要关注它的int返回值，它会告诉你读取了多少字节。

之所以会这样，我觉得跟socket网络通信受制于太多因素有关系。网速不好、等待时间长等都会影响socket的效率。而文件io一般就没有这些不稳定因素，只要磁盘文件存在并成功获取到文件句柄，读写基本就是磁盘性能的问题了，所以文件读写不支持非阻塞也就可以理解了；

但是这种非阻塞模式下，每次都要再次判断状态不是很烦么？所以一般的网络NIO都是跟Selector配合使用，将状态监听的任务交给Selector；文件IO没有非阻塞模式，自然也不能用Selector；具体代码我就不贴了，大家应该都能百度到；

那到底什么时候使用nio呢。这个问题有篇文章讲的很好，大家可以去看下：[http://ifeve.com/java-nio-vs-io/](http://ifeve.com/java-nio-vs-io/)
