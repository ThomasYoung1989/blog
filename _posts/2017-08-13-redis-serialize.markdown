---
layout: post
title: "redis序列化之踩坑填坑"
date: 2017-08-13 19:18
comments: true
categories: cache
---

redis从诞生之初就因为其多数据类型的支持，极高的读写性能为大家所熟悉，今天我不将redis的优点和性能，我讲讲java里面使用redis序列化时可能踩的一些坑；

java里最常用的redis client应该就是jedis了，配合spring-data-redis使用，可以与spring集成，简化很多操作。maven配置的话只需要引入以下两个包：

```xml
<dependency>
    <groupId>org.springframework.data</groupId>
    <artifactId>spring-data-redis</artifactId>
    <version>1.6.2.RELEASE</version>
</dependency>

<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
    <version>2.7.3</version>
</dependency>
```

spring配置如下：

```xml
<!-- 连接池-->
<bean id="jedisPoolConfig" class="redis.clients.jedis.JedisPoolConfig">
    <property name="maxTotal" value="@{redis.pool.maxTotal}" />
    <property name="maxIdle" value="@{redis.pool.maxIdle}" />
    <property name="maxWaitMillis" value="@{redis.pool.maxWaitMillis}" />
</bean>

<!-- 连接工厂-->
<bean id="connectionFactory"
class="org.springframework.data.redis.connection.jedis.JedisConnectionFactory"
p:host-name="@{redis.host}" p:port="@{redis.port}" p:timeout="@{redis.timeout}"
p:pool-config-ref="jedisPoolConfig" />

<!-- spring tempalte-->
<bean class="org.springframework.data.redis.core.RedisTemplate" >
    <property name="connectionFactory" ref="connectionFactory"/>
    <property name="keySerializer" ref="keySerializer"/>
    <property name="valueSerializer" ref="keySerializer"/>
    <property name="enableTransactionSupport" value="false"/>
</bean>

<bean id="keySerializer"
class="org.springframework.data.redis.serializer.StringRedisSerializer" />
```

在代码中直接引入RedisTemplate就可以用它的api做一些redis操作了。

今天既然讲序列化，我们先来看看redis有哪些序列化实现：

```java
//以下实现类都实现了RedisSerializer 接口

GenericJackson2JsonRedisSerializer //使用jackson序列化成json格式
GenericToStringSerializer //使用ConversionService序列化
Jackson2JsonRedisSerializer //使用jackson序列化成json格式
JacksonJsonRedisSerializer //使用jackson序列化成json格式
JdkSerializationRedisSerializer //jdk的序列化方案
OxmSerializer //序列化成xml格式
StringRedisSerialize //序列化成字符串
```

这几个序列化实现中有三个是json相关的，就是将对象序列化成json格式，具体实现大同小异大家可以去看源码，两个序列化成string字符串，还有一个jdk自带序列化和序列化成xml格式。
如果你觉得自己有更好的序列化思路，你也可以自己实现RedisSerializer接口完成一个自己的序列化方案，但是大多数情况下这些方案已经够用了。下面讲讲我踩过的坑。

* valueSerializer和keySerializer如果不配置，将使用默认序列化方案JdkSerializationRedisSerializer

默认序列化方案使用jdk自带的序列化方式，有人测试过性能还是不错的，就是序列化完的串长度很长。这还不是关键，如果你的key和value没有实现java的Serializable接口，那么就会造成序列化失败，直接报错。这个坑大家一不小心就会踩到，所以最好还是根据需求配置自己的序列化实现，千万不要偷懒使用默认的。

* valueSerializer设置成Jackson2JsonRedisSerializer时，不适合redis操作基础数据类型

我们在redis中存的最多的就是Pojo对象了，这些对象有清晰的结构，如果使用json序列化方案的话，在redis中以json字符串的形式存储，可读性很高。但是如果保存基本数据类型的话，就不太合适了，比如我要存一个字符串"0"，如果使用json序列化方法，在redis中存放的结构会是："\"0\"",其实直接存"0"才是合理的，而json为了将其存成一个json对象，又加了一层引号，显得多此一举。这还会造成一个问题：如果对此键进行increase操作，将会直接报错，因为redis不能将其转成一个int值。这种问题有两种解决方案：

1. 如果存的时候存的就是数字0，那json包装后会是"0",这样的格式也是对的。
1. 使用StringRedisSerialize，不管你存字符串"0"还是数字0，那我们存在库中的就是"0",后续做increase也是没有问题的。

如果用JdkSerializationRedisSerializer序列化呢，答案是同样不行，jdk序列化会将这个0序列化成一个只有jdk自己认识的字节码，导致increase无法执行。所以在做int,long,string啊这些基础数据类型的存储时，我推荐还是直接用string序列化方式，因为redis内部只支持string类型，这些基础类型其实都会存成string类型，用string序列化方式正好契合redis的要求。博主就曾经碰过这个坑，当时明明存进去一个"0"，用它做计数器做increase时就死活不行，最后发现时序列化搞的鬼。

* 执行lua脚本并传参数时，序列化同样会起作用

大家有时候会用到redis执行lua脚本的功能，因为lua脚本的单线程执行机制，保证了事务性，不会出现在并发执行时造成的数据错误。这边跟大家提个醒，传递的key和arg同样会被序列化，如果你传递的arg在lua脚本中有参与一些运算，那极有可能造成运算的报错。比如下面这段代码：

```java
         String SCRIPT_LUA = "local current = redis.call('GET', KEYS[1]);if not current"
                + " then "
                + " current=1;"
                + "  redis.call('SET',KEYS[1],1);"
                + " end;"
                + "redis.call('INCRBY', KEYS[1], ARGV[1]);"
                + "current = redis.call('GET', KEYS[1]);"
                + "return current;";
        RedisScript<Long> script = new DefaultRedisScript<Long>(
                SCRIPT_LUA,
                Long.class);
        Object aa = redisTemplate.execute(script, Arrays.asList(new String[] {
                "testCount"
        }), "1");
        return aa.toString();
```

代码中的lua脚本的意思是先判断key值是否存在，不存在则初始化set为1，初始化后再执行incrby操作，将原值增加argv[1];redistemplate提供execute方法第三个参数往后都是变量值，传递到脚本中对应ARGV数组，数组是从1开始的，这个需要注意下；如果此处传递的是"1"而序列化使用的json或者jdk，就会出现报错：

```java
redis.clients.jedis.exceptions.JedisDataException: ERR Error running script (call to f_805244dd6d5f8aa92576c2ea0d5f137412a54aa5): @user_script:1: ERR value is not an integer or out of range
```

这问题跟上面一样同样有两种解决方式:

1. 直接传数字1作为参数
1. 使用StringRedisSerialize作为序列化方案
