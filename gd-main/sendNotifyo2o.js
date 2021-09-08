/*
 * @Author: Waikkii https://github.com/Waikkii
 * @Date: 2021-08-13 00:00:01
 * sendNotify QQ一对一推送通知功能
 * @param text 通知头
 * @param cookie 检索ck
 * @param desp 通知体
 * @param author 作者仓库等信息  例：`本通知 By：https://github.com/Waikkii/gd`
 */

const querystring = require('querystring');
const $ = new Env();
const got = require('got');
require('dotenv').config();
const { readFile } = require('fs/promises');
const path = require('path');
const qlDir = process.env.QL_DIR || '/ql';
const authFile = path.join(qlDir, 'config/auth.json');
const api = got.extend({
  prefixUrl: process.env.QL_URL || 'http://localhost:5600',
  retry: { limit: 0 },
});
async function getToken() {
  const authConfig = JSON.parse(await readFile(authFile));
  return authConfig.token;
}

const timeout = 15000; //超时时间(单位毫秒)
let O2O_GOCQ_URL = '';
let O2O_GOCQ_GROUP_ID = '';

//==========================云端环境变量的判断与接收=========================
if (process.env.O2O_GOCQ_URL) {
    O2O_GOCQ_URL = process.env.O2O_GOCQ_URL;
}
if (process.env.O2O_GOCQ_GROUP_ID) {
    O2O_GOCQ_GROUP_ID = process.env.O2O_GOCQ_GROUP_ID;
}
//==========================云端环境变量的判断与接收=========================

/**
 * sendNotify 推送通知功能
 * @param text 通知头
 * @param desp 通知体
 * @param cookie 检索ck
 * @param author 作者仓库等信息  例：`本通知 By：https://github.com/Waikkii/gd`
 * @returns {Promise<unknown>}
 */
async function sendNotify(
  text,
  cookie,
  desp,
  author = '\n\n本通知 By：https://github.com/Waikkii/gd',
) {
  desp += author; //增加作者信息，防止被贩卖等
  text = text.match(/.*?(?=\s?-)/g) ? text.match(/.*?(?=\s?-)/g)[0] : text;
  //读取cookie的qq
  token = await getToken();
  body = await api({
      url: 'api/envs',
      searchParams: {
          searchValue: 'JD_COOKIE',
          t: Date.now(),
      },
      headers: {
          Accept: 'application/json',
          authorization: `Bearer ${token}`,
      },
  }).json();
  qq = '';
  user_qq = '';
  for(var i=0;i<body.data.length;i++){
    if(body.data[i].hasOwnProperty("remarks")){
      if(body.data[i].value==cookie){
          qq = body.data[i].remarks.split("=")[1];
          user_qq = qq.substring(0,qq.length-1);
          break;
      }
    }
  }
  //查询qq群所有用户
  user_list = await get_group_member_list(O2O_GOCQ_URL, O2O_GOCQ_GROUP_ID, "")
  //查询所有好友
  friend_list = await get_friend_list(O2O_GOCQ_URL, "")
  //判断qq是否在群里
  send_flag = 0;
  for(var i=0;i<user_list.data.length;i++){
    if(user_list.data[i].user_id==user_qq && user_qq!=''){
        send_flag = 1;
        break;
    }
  }
  //判断qq是否是好友
  for(var i=0;i<friend_list.data.length;i++){
    if(friend_list.data[i].user_id==user_qq && user_qq!=''){
        send_flag = 2;
        break;
    }
  }
  //如果在群里就发消息
  if (send_flag!=0){
    await Promise.all([
        o2ogocqNotify(text, user_qq, send_flag, desp, ""),//go-cqhttp
    ]);
  }
}

function get_group_member_list(url, group_id, data) {
    let body = {
        url: `${url}/get_group_member_list?group_id=${group_id}`,
    }
    return new Promise(resolve => {
        $.get(body, async (err, resp, data) => {
            try {
                if (err) {
                    console.log(`GO-CQHTTP get_group_member_list API请求失败，请检查网路重试`)
                } else {
                    data = JSON.parse(data);
                }
            } catch (e) {
                $.logErr(e, resp)
            } finally {
                resolve(data);
            }
        })
    })
}

function get_friend_list(url, data) {
    let body = {
        url: `${url}/get_friend_list`,
    }
    return new Promise(resolve => {
        $.get(body, async (err, resp, data) => {
            try {
                if (err) {
                    console.log(`GO-CQHTTP get_friend_list API请求失败，请检查网路重试`)
                } else {
                    data = JSON.parse(data);
                }
            } catch (e) {
                $.logErr(e, resp)
            } finally {
                resolve(data);
            }
        })
    })
}


function o2ogocqNotify(text, qq, flag, desp, data) {
    text=encodeURIComponent(text);
    desp=encodeURIComponent(desp.replace(/🧧/g,"[CQ:face,id=192]"));
    let body = ''
    if(flag==1){
        body = {url: `${O2O_GOCQ_URL}/send_private_msg?user_id=${qq}&group_id=${O2O_GOCQ_GROUP_ID}&message=${text}%0a${desp}`,}//不是好友
    }
    if(flag==2){
        body = {url: `${O2O_GOCQ_URL}/send_private_msg?user_id=${qq}&message=${text}%0a${desp}`,}//是好友
    }
    return new Promise(resolve => {
        $.get(body, async (err, resp, data) => {
            try {
                if (err) {
                    console.log('发送go-cqhttp通知调用API失败！！\n');
                    console.log(err);
                } else {
                    data = JSON.parse(data);
                    if (data.retcode === 0) {
                        console.log('go-cqhttp发送通知消息成功🎉\n');
                        } else if (data.retcode === 100) {
                        console.log(`go-cqhttp发送通知消息异常: ${data.errmsg}\n`);
                        } else {
                        console.log(
                            `go-cqhttp发送通知消息异常\n${JSON.stringify(data)}`,
                        );
                    }
                }
            } catch (e) {
                $.logErr(e, resp)
            } finally {
                resolve(data);
            }
        })
    })
}

module.exports = {
  sendNotify
};

// prettier-ignore
function Env(t,s){return new class{constructor(t,s){this.name=t,this.data=null,this.dataFile="box.dat",this.logs=[],this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,s),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}getScript(t){return new Promise(s=>{$.get({url:t},(t,e,i)=>s(i))})}runScript(t,s){return new Promise(e=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let o=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");o=o?1*o:20,o=s&&s.timeout?s.timeout:o;const[h,a]=i.split("@"),r={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:o},headers:{"X-Key":h,Accept:"*/*"}};$.post(r,(t,s,i)=>e(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s);if(!e&&!i)return{};{const i=e?t:s;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s),o=JSON.stringify(this.data);e?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(s,o):this.fs.writeFileSync(t,o)}}lodash_get(t,s,e){const i=s.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return e;return o}lodash_set(t,s,e){return Object(t)!==t?t:(Array.isArray(s)||(s=s.toString().match(/[^.[\]]+/g)||[]),s.slice(0,-1).reduce((t,e,i)=>Object(t[e])===t[e]?t[e]:t[e]=Math.abs(s[i+1])>>0==+s[i+1]?[]:{},t)[s[s.length-1]]=e,t)}getdata(t){let s=this.getval(t);if(/^@/.test(t)){const[,e,i]=/^@(.*?)\.(.*?)$/.exec(t),o=e?this.getval(e):"";if(o)try{const t=JSON.parse(o);s=t?this.lodash_get(t,i,""):s}catch(t){s=""}}return s}setdata(t,s){let e=!1;if(/^@/.test(s)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(s),h=this.getval(i),a=i?"null"===h?null:h||"{}":"{}";try{const s=JSON.parse(a);this.lodash_set(s,o,t),e=this.setval(JSON.stringify(s),i)}catch(s){const h={};this.lodash_set(h,o,t),e=this.setval(JSON.stringify(h),i)}}else e=$.setval(t,s);return e}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,s){return this.isSurge()||this.isLoon()?$persistentStore.write(t,s):this.isQuanX()?$prefs.setValueForKey(t,s):this.isNode()?(this.data=this.loaddata(),this.data[s]=t,this.writedata(),!0):this.data&&this.data[s]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,s=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?$httpClient.get(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status),s(t,e,i)}):this.isQuanX()?$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t)):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,s)=>{try{const e=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(e,null),s.cookieJar=this.ckjar}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t)))}post(t,s=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),delete t.headers["Content-Length"],this.isSurge()||this.isLoon())$httpClient.post(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status),s(t,e,i)});else if(this.isQuanX())t.method="POST",$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t));else if(this.isNode()){this.initGotEnv(t);const{url:e,...i}=t;this.got.post(e,i).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t))}}time(t){let s={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in s)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?s[e]:("00"+s[e]).substr((""+s[e]).length)));return t}msg(s=t,e="",i="",o){const h=t=>!t||!this.isLoon()&&this.isSurge()?t:"string"==typeof t?this.isLoon()?t:this.isQuanX()?{"open-url":t}:void 0:"object"==typeof t&&(t["open-url"]||t["media-url"])?this.isLoon()?t["open-url"]:this.isQuanX()?t:void 0:void 0;$.isMute||(this.isSurge()||this.isLoon()?$notification.post(s,e,i,h(o)):this.isQuanX()&&$notify(s,e,i,h(o))),this.logs.push("","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="),this.logs.push(s),e&&this.logs.push(e),i&&this.logs.push(i)}log(...t){t.length>0?this.logs=[...this.logs,...t]:console.log(this.logs.join(this.logSeparator))}logErr(t,s){const e=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();e?$.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):$.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(s=>setTimeout(s,t))}done(t={}){const s=(new Date).getTime(),e=(s-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${e} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,s)}
