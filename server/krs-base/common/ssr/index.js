/**
 * author:bigerfe.com
 * react 服务端组件渲染的入口文件
 * **/


import React from 'react';
import { renderToString, renderToStaticMarkup, renderToNodeStream } from 'react-dom/server';
import matchComponent from '../../../../src/app/match-component';
import Provider from '../../../../src/app/provider';
import ejsHtml from '../other/ejs-html';
import { StaticRouter,Switch,Route } from "react-router";
import { renderRoutes} from 'react-router-config';
import NoMatch from '../../../../src/pages/z-no-match';//0匹配的时候
import config from '../../config';
import CacheHelper from '../other/cache-helper';
import Layout from '../../../../src/app/layout';

import { getCacheStaticRoutes} from '../ssr/static-routes';


const getComponentHtml =async (ctx)=>{
   
    const routes = await getCacheStaticRoutes();

    let path = ctx.path, url = ctx.url;

    const routeMatch = await matchComponent(path, routes);

    const COM = routeMatch.component || NoMatch;

    const match = routeMatch.match || {};

    //参数带入
    const krsOpt = {
        query:ctx.query,
        params:match.params
    }

    //TODO:不知道还有没有更好的办法
    const initialData = {};//用于前端获取数据，区分多页面
    const fallData = initialData[path] = {};
    fallData.init = true;
    fallData.res = await (COM.getInitialProps ? COM.getInitialProps(krsOpt) : {});

    //处理页面 tdk
    fallData.res.page || (fallData.res.page={
        tdk:{
            title:'默认标题',
            keyword:'默认关键词',
            description:'默认描述'
        }
    })

    const props ={
        match: {
            url: ctx.path
        }
    };

    //没用到这
    const context = {};

    // <StaticRouter context={context} location={ctx.url}>
    const html = renderToString(<Provider initialData={{ initialData:initialData}}>
        <StaticRouter location={ctx.path} context={context}>
            <Layout>
            {renderRoutes(routes)}
            </Layout>
        </StaticRouter>
    </Provider>);

    return {
        html, initialData, page: fallData.res.page};
}


const renderBody =async  (ctx,data)=>{  
    ctx.body = await ejsHtml('../../temp/ssr.html',data);
}

export default async (ctx) => {

    ctx.set('Content-Type', 'text/html;charset=UTF-8');
    let htmlstr='',
    renderData={
        htmlContent:htmlstr,
        propsData:"{}",
        config:config.cdnHost,
        page:{}
    };

    if(config.isSSR){
        const res = await getComponentHtml(ctx);
        if(config.isDev){
            console.log('render html =======================');
            console.log('res',res);
        }
        renderData.htmlContent = res.html;

        //数据转成 base64 客户端再进行转换
        const base64Str = Buffer.from(JSON.stringify({ initialData: res.initialData || {} })).toString('base64');

        renderData.propsData = `<textarea style="display:none" id="krs-server-render-data-BOX">${base64Str}</textarea>` ;
        renderData.config = config.cdnHost;
        renderData.page =res.page;
    }else{
        renderData.propsData='';
        renderData.page.tdk={
            title:'krs',
            keyword:'krs keyword',
            description:'krs description'
        };
    }
    
    //是不是服务端的渲染静态资源都要输出
    renderData.page.staticSource=config.staticSource;

    await renderBody(ctx,renderData);
 
}