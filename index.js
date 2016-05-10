var express=require('express');
var _=require('lodash');
var path=require('path');
var bodyparser=require("body-parser");
var crypto=require('crypto');
var session=require('express-session');
var moment=require('moment');
var checkLogin=require('./checkLogin.js');
var methodOverride=require('method-override');

var Waterline=require('waterline');
var mysqlAdapter=require('sails-mysql');
var mongoAdapter=require('sails-mongo');

var adapters={
	mongo:mongoAdapter,
	mysql:mysqlAdapter,
	default:'mysql'
};

var connections={
	mongo:{
		adapter:'mongo',
		url:'mongodb://localhost/waterline_sample'
	},
	mysql:{
		adapter:'mysql',
		url:'mysql://root:wasd12345@localhost/waterlinesample'
	}
};

var User=Waterline.Collection.extend({
	identity:'user',
	connection:'mysql',
	schema:true,
	attributes:{
		username:{
			type:'string',
			required:true
		},
		password:{
			type:'string',
			required:true
		},
		email:'string',
		createTime:new Date()
		/*beforeCreate:function(value,cb){
			value.createTime=new Date();
			return cb();
		}*/
	}
});

var Note=Waterline.Collection.extend({
	identity:'note',
	connection:'mysql',
	attributes:{
		title:{
			type:'string',
			required:true
		},
		author:{
			type:'string',
			required:true
		},
		tag:{
			type:'string',
			required:true
		},
		content:{
			type:'string',
			required:true
		},
		createTime:new Date(),
		/*beforeCreate:function(value,cb){
			value.createTime=new Date();
			return cb();
		}*/
	}		
});

var orm=new Waterline();

orm.loadCollection(User);
orm.loadCollection(Note);

var config={
	adapters:adapters,
	connections:connections
};

//var mongoose=require('mongoose');
//var models=require('./models/models');

//mongoose.connect('mongodb://localhost:27017/notes');
//mongoose.connection.on('error',console.error.bind(console,'连接数据库失败'));

var app=express();

app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');

app.use(express.static(path.join(__dirname,'public')));

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended:true}));
app.use(methodOverride());

app.use(session({
	secret:'1234',
	name:'mynote',
	cookie:{maxAge:60*60*24*7},
	resave:false,
	saveUninitialized:true
}));

//app.get('/',checkLogin.noLogin);
app.get('/',function(req,res) {
	if(req.session.user != null) {
		app.models.note.find({author: req.session.user.username})
			.exec(function (err,models) {
				if (err) {
					console.log(err);
					return res.redirect('/');
				}
				//res.json(models);
				console.log(models);
				res.render('index', {
					title: '首页',
					user: req.session.user,
					notes:models
				});
			})
	} else {
		res.render('index', {
			title: '首页',
			user: req.session.user
		});
	}
});

var flag=0;//0-初始值；1-用户名已经存在；2-用户名只能包含大小写字母与数字，且为3-20个字符
var flag1=0;//0-初始值；1-密码必须包含大小写字母与数字，且长度不能少于6位
var flag2=0;//0-初始值；1-请再输入一次确认密码；2-两次输入的密码不一致

app.get('/register',function(req,res){
    if(req.session.user == null) {
        console.log('注册！');
        res.render('register', {
			user: req.session.user,
			flag: flag,
			flag1:flag1,
			flag2:flag2,
			title: '注册'
		});
		flag=req.session.flag;
		flag1=req.session.flag1;
		flag2=req.session.flag2;
    } else {
        console.log('您已经登录！');
        return res.redirect('/');
    }
});

app.post('/register',function(req,res){
	var username=req.body.username,
		password=req.body.password,
		passwordRepeat=req.body.passwordRepeat;

	var checkusername=/^\w{3,20}$/;
	var checkpassword=/^(?=.{6,})(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).*$/;

	if(username.trim().length==0) {
		console.log("用户名不能为空！");
		return res.redirect('/register');
	} else if (!(checkusername.test(username.trim()))) {
        console.log("用户名只能包含大小写字母与数字，且为3-20个字符！");
		flag=2;
        return res.redirect('/register');
    } else if (!(checkpassword.test(password.trim()))) {
        console.log("密码必须包含大小写字母与数字，且长度不能少于6位！");
		flag1=1;
        return res.redirect('/register');
    } else if(passwordRepeat.trim().length==0) {
		console.log("请再输入一次确认密码！");
		flag2=1;
		return res.redirect('/register');
	} else if(password!=passwordRepeat) {
		console.log("两次输入的密码不一致！");
		flag2=2;
		return res.redirect('/register');
	}

	app.models.user.findOne({username:username},function(err,model){
		if(err){
			console.log(err);
			return res.redirect('/register');
		}

		if(model){
			console.log('用户名已经存在');
			flag=1;
			return res.redirect('/register');
		}

		var md5=crypto.createHash('md5'),
			md5password=md5.update(password).digest('hex');
		
		//res.json(model);
		app.models.user.create({username:username,password:md5password},function(err,model){
			if(err){
				console.log(err);
				return res.redirect('/register');
			}
			//res.json(model);
			console.log(model);
			console.log("注册成功！");
			return res.redirect('/');
		});
	});
});

app.get('/login',function(req,res){
    if(req.session.user==null) {
        console.log('登录！');
			res.render('login', {
				user: req.session.user,
				title: '登录'
			});
    } else {
        console.log('您已经登录！');
        return res.redirect('/');
    }
});

app.post('/login',function(req,res){
	var username=req.body.username,
		password=req.body.password;

	app.models.user.findOne({username:username},function(err,model){
		if(err){
			console.log(err);
			return res.redirect('/login');
		}
		if(!model){
			console.log('用户不存在！');
			return res.redirect('/login');
		}

		var md5=crypto.createHash('md5'),
			md5password=md5.update(password).digest('hex');
		if(model.password!==md5password){
			console.log('密码错误！');
			return res.redirect('/login');
		}
		//res.json(model);
		console.log('登陆成功！');
		model.password=null;
		//delete user.password;
		req.session.user=model;
		return res.redirect('/');
	});
});

app.get('/quit',function(req,res){
	req.session.user=null;
	console.log('退出！');
	delete user;
	return res.redirect('/login');
});

app.get('/post',function(req,res){
	console.log('发布！');
	res.render('post',{
		user:req.session.user,
		title:'发布'
	});
});

app.post('/post',function(req,res){
	app.models.note.create({title:req.body.title,author:req.session.user.username,tag:req.body.tag,content:req.body.content},function(err,model){
		if(err){
			console.log(err);
			return res.redirect('/post');
		}
		//res.json(model);
		console.log(model);
		console.log('文章发表成功！');
		return res.redirect('/');
	});
});

app.get('/detail/:_id',function(req,res){
	console.log('查看笔记！');
	app.models.note.findOne({_id:req.params._id},function(err,model){
		if(err){
			console.log(err);
			return res.redirect('/');	
		}
		if(model){
			res.render('detail',{
				title:'笔记详情',
				user:req.session.user,
				art:model,
				moment:moment
			});
		
		}
	});
});

orm.initialize(config,function(err,models){
	if(err){
		console.error('orm initialize failed.',err);
		return;
	}
	app.models=models.collections;
	app.connections=models.connections;

	app.listen(3000);
	console.log('app is running at port 3000');
});
