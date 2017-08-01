---
layout: post
title: "nodejs server的性能测试分析"
date: 2017-07-27 15:22
comments: true
categories: nodejs
---

nodejs作为服务端server的方案已经出来很多年了，各家公司也提供了一些最佳实践的方案，但是由于一直做传统项目，使用java企业级方案更多，很少涉及互联网项目，在实际项目中一直没有机会去实践，而自己对于nodejs到底有怎样的性能优势一直很好奇。最近正好有时间，就借此机会对nodejs的server做了一次简单的压测，跟tomcat做了一下对比。

# why nodejs

## nodejs的优势

* 单线程，单进程
* 事件模型
* 高性能Chrome V8引擎
* 非阻塞IO
* 及其轻量、可伸缩

## 典型场景

我们在做前端项目时，经常碰到一种场景：当有js大量计算的逻辑时，整个页面都处于一种假死的状态，这是由于js的单线程特质造成的，如果cpu资源被拿去计算了，那页面渲染的任务就拿不到cpu资源，只能等待系统调度偷来几个时间片。如果那个业务全程占用cpu都不释放，那页面渲染任务就完全停止了，页面就处于假死的状态。

nodejs同样是用js业务，js的问题它当然都有。nodejs鲜明的单线程单进程的特点决定了它几乎不可能做cpu密集型业务，因为他只能使用单核的cpu，在多核机器上只能通过横向扩展部署多个实例的方式以充分利用多核cpu的性能。典型的使用场景或者唯一的使用场景就是io密集型的业务，比如查询数据库取一些数据、调用一些接口取写数据然后做一些简单的数据组装返回。而且由于它单线程的特点，消耗资源特别少，内存占用也很少（每个线程都要分配栈内存）。

看完这些你肯定就明白，为什么互联网公司特别喜欢了。互联网公司有着大量的高并发请求，每秒钟上万请求的业务比比皆是，请求本身就是很简单的查询和展示。如果使用传统java服务器，很快就达到性能瓶颈，这时候nodejs的优点就被放大。说了这么多，我们还是测试一把，干巴巴的讲不如写几行代码跑一把。

# nodejs server选型
当前市面上还是有很多nodejs server可供选择的，当然我们也可以自己根据nodejs提供的网络接口自己写server，但是为了效率，我们还是选择一些成熟的框架来做测试吧！毕竟绝大多数公司还是会选择成熟的开源框架开始他们的工作而不是重头开始。

* express 最早的web server，使用最多，应用最广
* Hapi 由express演变而来,配置优于编码，业务逻辑必须和传输层进行分离
* koa 比较年轻的server，可以利用 Node harmony 的 generators 特性来写出没有 callback 的代码
* koa2 koa的升级版，使用async/await做异步开发，完全抛弃了generators的写法

其实这些server的性能都是大同小异，因为他们都得在nodejs上跑，运行的环境决定了他们的性能上限，只是每个server都制定了自己的一套规范写法，充分使用js的新特性新语法提供高可读性的代码和高可维护性的项目结构。我最终选择了最新的koa2做了测试server，因为在it界最新的往往意味着最好的。

# 测试代码准备

## koa2 js代码
koa这边使用了router中间件，拦截一个请求，发起一次sql查询,然后返回。一些基本的连接启动的代码我就不贴了，直接贴业务代码

数据库查询代码：

```js
    const mysql = require('mysql')

    const pool = mysql.createPool({
    host     :  '**',
    user     :  '**',
    password :  '**',
    database :  '**'
    })
    let query = function( sql, values ) {

    return new Promise(( resolve, reject ) => {
        pool.getConnection(function(err, connection) {
        if (err) {
            reject( err )
        } else {
            connection.query(sql, values, ( err, rows) => {
            if ( err ) {
                reject( err )
            } else {
                resolve( rows )
            }
            connection.release()
            })
        }
        })
    })

    }
```

router拦截并调用查询接口代码：

```js
    module.exports = router.get('/get/data.json', async ( ctx )=>{
    //sql查询，使用了mysql
    let result = await query( "select sum(mobile_book_nums) as '移动端',sum(pc_book_nums) as 'PC端' from ol_itf_nbd_tourist_info where(start_date>='2015-01-09' and start_date<='2017-02-15')" )
    // let result = await sleep(2000)
    console.log(result)

    ctx.body = {
        success: true,
        data: {
        text: 'hello world!'
        }
    }
    })
```

## tomcat java代码

java代码就很简单了，就是基本的springmvc+mybatis

```java
    @RequestMapping("/testQuery")
    @ResponseBody
    public Object testQuery() {
        try {
            List<Map<String, Object>> aa = reportServiceImpl.reportQuery(
            "select sum(mobile_book_nums) as '移动端',sum(pc_book_nums) as 'PC端' from ol_itf_nbd_tourist_info where(start_date>='2017-01-09' and
            start_date<='2017-02-15')");
        } catch (Exception e) {
            e.printStackTrace();
        }
        return "{success: true,data: {text: 'hello world!'}}";
    }

```

## 执行结果

统一使用apache ab命令进行测试

### 第一轮：模拟30个用户同时发起请求

* nodejs测试结果

```bash
D:\server\Apache24\bin>ab -n 30 -c 30  http://127.0.0.1:3000/api/get/data.json
This is ApacheBench, Version 2.3 <$Revision: 1706008 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking 127.0.0.1 (be patient).....done


Server Software:
Server Hostname:        127.0.0.1
Server Port:            3000

Document Path:          /api/get/data.json
Document Length:        47 bytes

Concurrency Level:      30
Time taken for tests:   6.129 seconds
Complete requests:      30
Failed requests:        0
Total transferred:      5670 bytes
HTML transferred:       1410 bytes
Requests per second:    4.90 [#/sec] (mean)
Time per request:       6128.613 [ms] (mean)
Time per request:       204.287 [ms] (mean, across all concurrent requests)
Transfer rate:          0.90 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.5      0       1
Processing:  1478 3632 1509.8   3950    5934
Waiting:     1478 3626 1518.0   3950    5934
Total:       1479 3632 1509.7   3950    5934

Percentage of the requests served within a certain time (ms)
  50%   3950
  66%   4350
  75%   5046
  80%   5397
  90%   5709
  95%   5791
  98%   5934
  99%   5934
 100%   5934 (longest request)

```

* tomcat测试结果

```bash
D:\server\Apache24\bin>ab -n 30 -c 30  http://127.0.0.1:8080/api/testQuery

Server Software:        Apache-Coyote/1.1
Server Hostname:        127.0.0.1
Server Port:            8080

Document Path:          /api/testQuery
Document Length:        44 bytes

Concurrency Level:      30
Time taken for tests:   4.655 seconds
Complete requests:      30
Failed requests:        0
Total transferred:      65730 bytes
HTML transferred:       1320 bytes
Requests per second:    6.44 [#/sec] (mean)
Time per request:       4655.465 [ms] (mean)
Time per request:       155.182 [ms] (mean, across all concurrent requests)
Transfer rate:          13.79 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.4      0       1
Processing:  1940 3326 877.2   3509    4481
Waiting:     1940 3319 885.3   3507    4480
Total:       1941 3326 877.2   3509    4481

Percentage of the requests served within a certain time (ms)
  50%   3509
  66%   3807
  75%   4208
  80%   4225
  90%   4400
  95%   4446
  98%   4481
  99%   4481
 100%   4481 (longest request)

```

* 结论

nodejs访问时间更加离散，Java更加均衡；从平均时间来看，java性能占优；

### 第二轮：模拟60个用户同时发起请求

由于占用篇幅较长，我只贴最后的时间结果：

* nodejs测试结果

```bash
Percentage of the requests served within a certain time (ms)
  50%   6497
  66%   7752
  75%   8640
  80%   9066
  90%  10335
  95%  10590
  98%  10726
  99%  10880
 100%  10880 (longest request)
```

* tomcat测试结果

```bash
Percentage of the requests served within a certain time (ms)
  50%   5582
  66%   6459
  75%   6951
  80%   7205
  90%   7753
  95%   7871
  98%   7883
  99%   8054
 100%   8054 (longest request)
```

* 结论

跟第一轮测试结果基本相同，nodejs并没有性能优势，而且在加大并发量之后，性能也并没有优势，因为瓶颈出现在了mysql数据库查询那边，前台再大的量数据查询那边效率上不去，也不能体现出nodejs的优势。

# 测试代码修改

从上面的测试来看，我没有看到nodejs在性能上的优势，我首先怀疑的是nodejs的mysql连接池性能是不是有问题，为了更纯粹地反应nodejs真实的性能结果，我对代码做了修改，将sql查询部分直接换成休眠2秒，java也做相应修改。

```js
    let sleep = function( time ) {
    return new Promise(( resolve, reject ) => {
        setTimeout(function() {
        resolve("result");
        }, time);
    })

    }

    module.exports = router.get('/get/data.json', async ( ctx )=>{
    let result = await sleep(2000)
    console.log(result)
    ctx.body = {
        success: true,
        data: {
        text: 'hello world!'
        }
    }
    })
```

```java
    @RequestMapping("/testQuery")
    @ResponseBody
    public Object testQuery() {
        try {
            Thread.currentThread().sleep(2000);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return "{success: true,data: {text: 'hello world!'}}";
    }

```

## 执行结果

这次不涉及io操作，我直接从300开始测试，加大并发量

### 第一轮：模拟300个用户同时发起请求

* nodejs测试结果

```bash
Percentage of the requests served within a certain time (ms)
  50%   2054
  66%   2075
  75%   2077
  80%   2079
  90%   2083
  95%   2083
  98%   2084
  99%   2084
 100%   2158 (longest request)
```

* tomcat测试结果(默认连接数情况下)

```bash
Percentage of the requests served within a certain time (ms)
  50%   2092
  66%   2107
  75%   3996
  80%   4011
  90%   4018
  95%   4018
  98%   4020
  99%   4020
 100%   4022 (longest request)
```

* tomcat测试结果(调优最大连接数至1000情况下)

```bash
Percentage of the requests served within a certain time (ms)
  50%   2085
  66%   2088
  75%   2091
  80%   2092
  90%   2096
  95%   2098
  98%   2101
  99%   2102
 100%   2144 (longest request)
```

* 结论

300并发时，没有调优的tomcat已经力不从心了，tomcat默认的最大连接数是75，调整过最大连接数为300之后，性能有明显提升；

### 第二轮：模拟600个用户同时发起请求

* nodejs测试结果

```bash
Percentage of the requests served within a certain time (ms)
  50%   2136
  66%   2160
  75%   2164
  80%   2166
  90%   2170
  95%   2173
  98%   2174
  99%   2176
 100%   2179 (longest request)
```

* tomcat测试结果(调优最大连接数至1000情况下)

```bash
Percentage of the requests served within a certain time (ms)
  50%   2180
  66%   2189
  75%   2195
  80%   2198
  90%   2203
  95%   2208
  98%   2212
  99%   2215
 100%   2218 (longest request)
```

* 结论

调优过的tomcat跟nodejs访问速度方面差不太多。

## 总结

很多轮测试过后，我们发现在没有io瓶颈时，tomcat并发线程数管够的情况下，tomcat和node的性能没有太大差别。但是我一直没有跟大家讲资源消耗，这才是nodejs最牛的地方。

在上面测试到600并发的时候，tomcat内存占用从最初启动时的*630M*(因为在一个大项目上做的测试)提升至*900M*左右，多占用了*270M*的内存；而nodejs这边，我们会发现有两个nodejs进程在运行，总的内存占用也没有超过*100M*，即使提高到1000并发也只有100M左右的内存占用，总体来说资源占用真的是很有优势的。

总的来说，测试的结果和我们最上面的调研结果基本相似，对于io密集型的业务，nodejs确实有特别的优势，可以利用极少的资源完成大并发的任务。至于为什么nodeks的mysql连接池为什么性能这么差，我还不是很清楚，研究过的同学可以在下面留言多多交流！



