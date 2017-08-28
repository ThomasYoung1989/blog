---
layout: post
title: "跨域请求的配置和ajax session保持"
date: 2017-04-01 11:18
comments: true
categories: fontend
---

## 前言

最近在做一个前后端分离的项目，前台页面是配置在公司CMS系统上的，本来我没有特别留意这类项目会有什么特殊性，像往常一样开发着接口，也用到session去做验证码的保存和校验。但是在实际联调时，一开始就碰到了问题：跨域的ajax请求进了后台controller，代码业务也走完了，前台却没有任何返回也不报错。当时知道是跨域引起的，前台没有任何返回应该浏览器因为安全性问题做了拦截；跨域的解决方案很多，可以自己写过滤器做处理，但是我们一般使用前人留下的宝藏很少自己现挖，这类过滤器很多，甚至tomcat都自己带了，都是大同小异的，其中以thetransactioncompany公司的开源包使用最多。

## 配置

首先需要在pom中引入包：

```xml
    <dependency>
        <groupId>com.thetransactioncompany</groupId>
        <artifactId>cors-filter</artifactId>
        <version>2.5</version>
    </dependency>
```

然后只需要在web.xml里面配置上这个filter：

```xml

<filter>  
    <!-- The CORS filter with parameters -->  
    <filter-name>CORS</filter-name>  
    <filter-class>com.thetransactioncompany.cors.CORSFilter</filter-class>  

    <!-- Note: All parameters are options, if omitted the CORS   
        Filter will fall back to the respective default values.  
    -->
    <init-param>  
    <param-name>cors.allowGenericHttpRequests</param-name>  
    <param-value>true</param-value>  
    </init-param>  

    <init-param>  
    <param-name>cors.allowOrigin</param-name>  
    <param-value>*</param-value>  
    </init-param>  

    <init-param>  
    <param-name>cors.allowSubdomains</param-name>  
    <param-value>false</param-value>  
    </init-param>  

    <init-param>  
    <param-name>cors.supportedMethods</param-name>  
    <param-value>GET, HEAD, POST, OPTIONS</param-value>  
    </init-param>  

    <init-param>  
    <param-name>cors.supportedHeaders</param-name>  
    <param-value>*</param-value>  
    </init-param>  

    <init-param>  
    <param-name>cors.exposedHeaders</param-name>  
    <param-value>X-Test-1, X-Test-2</param-value>  
    </init-param>  

    <init-param>  
    <param-name>cors.supportsCredentials</param-name>  
    <param-value>true</param-value>  
    </init-param>  

    <init-param>  
    <param-name>cors.maxAge</param-name>  
    <param-value>3600</param-value>  
    </init-param>  

</filter>  

<filter-mapping>  
    <!-- CORS Filter mapping -->  
    <filter-name>CORS</filter-name>  
    <url-pattern>/cre/api/*</url-pattern>  
</filter-mapping>  

```

上述配置都是什么意思呢：

| Attribute                | Description                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|cors.allowGenericHttpRequests |非跨域请求是否可以通过此过滤器，默认为true；如果设置为false，则只有跨域的请求被允许。|
| cors.allowOrigin   | 设置可以http请求origin属性访问的白名单，用逗号分隔的方式来设置,* 号代表全部允许，默认为 * ，比如：http://www.w3.org，https://www.apache.org。|
|cors.allowSubdomains|是否允许来自allowOrigin的子域名的请求，默认不允许；子域名的概念大家应该清楚，www.example.com是example.com的子域名。|
| cors.allowed.methods     | 允许的http方法，可用逗号分隔，可选的枚举值为：GET, POST, HEAD, OPTIONS|
| cors.supportedHeaders   | 允许的请求头，可用逗号分隔，*号代表全部允许,默认 *。比如：Origin,Accept. Defaults: Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers；不被允许的请求头将无法传入，这些请求头会在预飞相应头中以Access-Control-Allow-Headers返回回去供调用者查看。  |
| cors.exposedHeaders     | 除了上面的头信息，这边可设置允许的自定义的复杂头信息，使用逗号分隔，不设置则默认为空。比如：X-CUSTOM-HEADER-PING,X-CUSTOM-HEADER-PONG，这些请求头会在预飞相应头中以 Access-Control-Expose-Headers 返回回去供调用者查看。  |
| cors.supportsCredentials  |指示是否支持用户凭据（如cookie、HTTP身份验证或客户端证书）。CORS系统的过滤器使用此值在构建访问控制允许凭据头。默认为true|
| cors.maxAge  |浏览器缓存预飞请求的结果的最长时间，如果设为-1，则使用 Access-Control-Max-Age头来传递。推荐设置为3600，即缓存一小时|
| cors.tagRequests  | 是否将cors特有的属性传递给下游处理器做处理，默认为false  |


## 总结

看完上面的说明，大家应该了解了各个参数的含义，其实跨域的请求时很复杂的，摊开来讲的话可以讲很多。跨域的解决方案也很多，比如大家最爱用的jsonp。跨域不是所有浏览器都支持的，支持CORS的浏览器有

1. Chrome 3+

1. Firefox 3.5+

1. Opera 12+

1. Safari 4+

1. IE 8+

CORS的请求方式分两种：简单请求和非简单请求。

简单请求满足下列两点：

1. HTTP Method为下列三种：HEAD、GET、POST

1. HTTP Headers中主要包括Accept、Accept-Language、Content-Language、Last-Event-ID以及Content-Type（Content-Type只能取1application/x-www-form-urlencoded、2multipart/form-data、3text/plain这三种）。

其他情况都属于非简单请求。

像目前比较常用的JSON-P来进行GET方法的跨域，用的就是简单请求。但是如果用JSON，那肯定就是非简单请求了。

简单请求已经可以解决我们的大多数问题，而非简单请求则复杂的多，在真正的请求前会发送一次prefightrequest 预飞请求，服务器给他返回一个prefightresponse预飞响应，通过这次预飞请求和响应，它就做好了所有的验证的工作，验证此请求是否能够符合上述的一堆的限制条件，如果符合条件，则发起第二次请求，第二次请求才是真正的业务请求。

## session问题解决

再回到上面的问题，我们在做一个验证码校验的功能，生成的验证码放在了session里，提交ajax请求时再从session中获取验证码与用户输入端的进行验证。session需要cookie做支撑，如果需要跨域请求携带cookie，我们看完上面的配置讲解应该很清楚了，只需要cors.supportsCredentials设置为true即可。配置完后我们发现还是获取不到正确的session，那是我们的ajax还有一处配置需要设置：

```js
$.ajax({
    url:url,
    //跨域支持 begin
    xhrFields: {
        //携带cookie
        withCredentials: true
    },
    crossDomain: true,
    //跨域支持 end
    success:function(result){
    },
    error:function(){
    }
});
```

##扩展

Spring 5对cors提供了支持，也提供了更友好的api，具体可参考此博客

[https://ifeve.com/%E3%80%8Aspring-5-%E5%AE%98%E6%96%B9%E6%96%87%E6%A1%A3%E3%80%8B20-cors-%E6%94%AF%E6%8C%81/#more-33240](https://ifeve.com/%E3%80%8Aspring-5-%E5%AE%98%E6%96%B9%E6%96%87%E6%A1%A3%E3%80%8B20-cors-%E6%94%AF%E6%8C%81/#more-33240)