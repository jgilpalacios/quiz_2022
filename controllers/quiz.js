const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const {models} = require("../models");

const paginate = require('../helpers/paginate').paginate;

// Autoload el quiz asociado a :quizId
exports.load = async (req, res, next, quizId) => {

    try {
        const quiz = await models.Quiz.findByPk(quizId);
        if (quiz) {
            req.load = {...req.load, quiz};
            next();
        } else {
            throw new Error('There is no quiz with id=' + quizId);
        }
    } catch (error) {
        next(error);
    }
};


// GET /quizzes
exports.index = async (req, res, next) => {

    let countOptions = {};
    let findOptions = {};

    // Search:
    const search = req.query.search || '';
    if (search) {
        const search_like = "%" + search.replace(/ +/g,"%") + "%";

        countOptions.where = {question: { [Op.like]: search_like }};
        findOptions.where = {question: { [Op.like]: search_like }};
    }

    try {
        const count = await models.Quiz.count(countOptions);

        // Pagination:

        const items_per_page = 10;

        // The page to show is given in the query
        const pageno = parseInt(req.query.pageno) || 1;

        // Create a String with the HTMl used to render the pagination buttons.
        // This String is added to a local variable of res, which is used into the application layout file.
        res.locals.paginate_control = paginate(count, items_per_page, pageno, req.url);

        findOptions.offset = items_per_page * (pageno - 1);
        findOptions.limit = items_per_page;

        const quizzes = await models.Quiz.findAll(findOptions);
        res.render('quizzes/index.ejs', {
            quizzes,
            search
        });
    } catch (error) {
        next(error);
    }
};


// GET /quizzes/:quizId
exports.show = (req, res, next) => {

    const {quiz} = req.load;

    res.render('quizzes/show', {quiz});
};


// GET /quizzes/new
exports.new = (req, res, next) => {

    const quiz = {
        question: "",
        answer: ""
    };

    res.render('quizzes/new', {quiz});
};

// POST /quizzes/create
exports.create = async (req, res, next) => {

    const {question, answer} = req.body;

    let quiz = models.Quiz.build({
        question,
        answer
    });

    try {
        // Saves only the fields question and answer into the DDBB
        quiz = await quiz.save({fields: ["question", "answer"]});
        req.flash('success', 'Quiz created successfully.');
        res.redirect('/quizzes/' + quiz.id);
    } catch (error) {
        if (error instanceof Sequelize.ValidationError) {
            req.flash('error', 'There are errors in the form:');
            error.errors.forEach(({message}) => req.flash('error', message));
            res.render('quizzes/new', {quiz});
        } else {
            req.flash('error', 'Error creating a new Quiz: ' + error.message);
            next(error);
        }
    }
};


// GET /quizzes/:quizId/edit
exports.edit = (req, res, next) => {

    const {quiz} = req.load;

    res.render('quizzes/edit', {quiz});
};


// PUT /quizzes/:quizId
exports.update = async (req, res, next) => {

    const {body} = req;
    const {quiz} = req.load;

    quiz.question = body.question;
    quiz.answer = body.answer;

    try {
        await quiz.save({fields: ["question", "answer"]});
        req.flash('success', 'Quiz edited successfully.');
        res.redirect('/quizzes/' + quiz.id);
    } catch (error) {
        if (error instanceof Sequelize.ValidationError) {
            req.flash('error', 'There are errors in the form:');
            error.errors.forEach(({message}) => req.flash('error', message));
            res.render('quizzes/edit', {quiz});
        } else {
            req.flash('error', 'Error editing the Quiz: ' + error.message);
            next(error);
        }
    }
};


// DELETE /quizzes/:quizId
exports.destroy = async (req, res, next) => {

    try {
        await req.load.quiz.destroy();
        req.flash('success', 'Quiz deleted successfully.');
        res.redirect('/goback');
    } catch (error) {
        req.flash('error', 'Error deleting the Quiz: ' + error.message);
        next(error);
    }
};


// GET /quizzes/:quizId/play
    exports.play = (req, res, next) => {

        const {query} = req;
        const {quiz} = req.load;

        const answer = query.answer || '';

        res.render('quizzes/play', {
            quiz,
            answer
        });
    };


// GET /quizzes/:quizId/check
    exports.check = (req, res, next) => {

        const {query} = req;
        const {quiz} = req.load;

        const answer = query.answer || "";
        const result = answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim();

        res.render('quizzes/result', {
            quiz,
            result,
            answer
        });
    };

//GET /quizzes/randomplay

exports.randomPlay =  async (req, res, next) => {

    try {
        let score=0;
        let orden=[];//contendra el array con el orden al azar en que se formularán
        let quizzes;
        let noRecargaCheck=true;
        if(req.session.score===undefined){//preparamos la tanda de preguntas desordenadas
            const count = await models.Quiz.count();
            quizzes = await models.Quiz.findAll();//todas las preguntas
            for (let i=0;i<count;i++)orden.push(i);
            for (let i=0;i<count;i++){
                let pos=Math.floor(count*Math.random());
                let aux=orden[i];
                orden[i]=orden[pos];
                orden[pos]=aux;
            }
            req.session.score=0
            req.session.orden=orden;//el orden al azar en que se preguntarán
            req.session.quizzes=quizzes;
        }else{
            orden = req.session.orden;
            quizzes = req.session.quizzes;
           
        }
        score = req.session.score;
        req.session.noRecargaCheck=noRecargaCheck;//para evitar que aumente el score si se recarga el resultado; 
        
        let quiz=quizzes[orden[score]];//tomamos el que corresponde a partir del array de orden al azar
        
        if (score===orden.length){//no more quiz
            delete req.session.score; 
            res.render('quizzes/random_nomore', {
                score
            });
        } else{
            res.render('quizzes/random_play', {
                quiz,
                score
            });
        }
    } catch (error) {
        next(error);
    }
    
};

    //GET /quizzes/randomcheck/:quizId
    exports.randomCheck = (req, res, next) => {

        const {query} = req;
        const {quiz} = req.load;

        const answer = query.answer || "";
        const result = answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim();
        
        let score;
        if (result){
            if(req.session.noRecargaCheck) score=++req.session.score;
            else score=req.session.score;//no se incrementa si se ha recargado
        }else{
            score=req.session.score;
            delete req.session.score; 
        }
        req.session.noRecargaCheck=false; //para que no se aumente el escore si se recarga esta url
        
            res.render('quizzes/random_result', {
                quiz,
                result,
                answer,
                score
            });
        
    };