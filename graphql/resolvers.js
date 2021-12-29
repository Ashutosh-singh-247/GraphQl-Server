const User = require('../models/user');
const Post = require('../models/post');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const clearImage = require('../helpers/file');

module.exports = {
    createUser: async(args, req) => {
        try {
            const errors = [];
            if(!validator.isEmail(args.userInput.email)) {
                errors.push({ message: 'Email is invalid' });
            };
            if(validator.isEmpty(args.userInput.password) || !validator.isLength(args.userInput.password, { min: 5 })) {
                errors.push({ message: 'Password is too short' });
            };

            if(errors.length > 0) {
                const error = new Error('Invalid input');
                error.data = errors;
                error.statusCode = 422;
                throw error;
            };

            const existingUser = await User.findOne({ email: args.userInput.email });
            if (existingUser) {
                throw new Error('User exists already.');
            };
            const hashedPassword = await bcrypt.hash(args.userInput.password, 12);
            const user = new User({
                name: args.userInput.name,
                email: args.userInput.email,
                password: hashedPassword
            });
            const result = await user.save();
            return { ...result._doc, _id: result._id.toString(), password: null, };
        } catch (err) {
            throw err;
        }
    },
    login: async(args) => {
        try {
            const user = await User.findOne({ email: args.email });
            if (!user) {
                throw new Error('User does not exist!');
            };
            const isEqual = await bcrypt.compare(args.password, user.password);
            if (!isEqual) {
                throw new Error('Password is incorrect!');
            };
            const token = jwt.sign({ userId: user._id.toString(), email: user.email }, 'somesupersecretsecret', {
                expiresIn: '1h'
            });
            return { token: token, userId: user._id.toString() };
        } catch (err) {
            throw err;
        }
    },
    createPost: async(args, req) => {
        try {
            if (!req.isAuth) {
                const error = new Error('Not authenticated!');
                error.statusCode = 401;
                throw error;
            };
            const errors = [];
            if(validator.isEmpty(args.postInput.title) || !validator.isLength(args.postInput.title, { min: 5 })) {
                errors.push({ message: 'Title is too short' });
            }

            if(validator.isEmpty(args.postInput.content) || !validator.isLength(args.postInput.content, { min: 5 })) {
                errors.push({ message: 'Content is too short' });
            }

            if(errors.length > 0) {
                const error = new Error('Invalid input');
                error.data = errors;
                error.statusCode = 422;
                throw error;
            }

            const user = await User.findById(req.userId);

            if(!user){
                const error = new Error('Invalid User');
                error.data = errors;
                error.statusCode = 401;
                throw error;
            }
            const post = new Post({
                title: args.postInput.title,
                content: args.postInput.content,
                imageUrl: args.postInput.imageUrl,
                creator: user
            });
            const result = await post.save();

            user.posts.push(post);
            await user.save();
            return { 
                ...result._doc, _id: result._id.toString(), 
                createdAt: result.createdAt.toISOString(), 
                updatedAt: result.updatedAt.toISOString()
            };
        } catch (error) {
            throw error;
        }
    },
    getPosts: async(args, req) => {
        try {
            if (!req.isAuth) {
                const error = new Error('Not authenticated!');
                error.statusCode = 401;
                throw error;
            };

            if(!args.page) {
                args.page = 1;
            };

            const perPage = 2;

            const totalItems = await Post.find().countDocuments();
            const posts = await Post.find()
            .populate('creator')
            .sort({ createdAt: -1 })
            .skip((args.page - 1) * perPage)
            .limit(perPage);

            return {
                posts: posts.map(post => {
                    return {
                        ...post._doc,
                        _id: post._id.toString(),
                        createdAt: new Date(post.createdAt).toISOString(),
                        updatedAt: new Date(post.updatedAt).toISOString()
                    }
                }
                ),
                totalItems
            };

        } catch (error) {
            throw error;
        }
    },
    singlePost: async(args, req) => {
        try {
            if (!req.isAuth) {
                const error = new Error('Not authenticated!');
                error.statusCode = 401;
                throw error;
            };

            const post = await Post.findById(args.postId).populate('creator');
            if(!post) {
                const error = new Error('Post not found!');
                error.statusCode = 404;
                throw error;
            };
            return {
                ...post._doc,
                _id: post._id.toString(),
                createdAt: new Date(post.createdAt).toISOString(),
                updatedAt: new Date(post.updatedAt).toISOString()
            };
        } catch (error) {
            throw error;
        }
    },
    updatePost: async(args, req) => {
        try {
            if (!req.isAuth) {
                const error = new Error('Not authenticated!');
                error.statusCode = 401;
                throw error;
            };

            const errors = [];
            if(validator.isEmpty(args.postInput.title) || !validator.isLength(args.postInput.title, { min: 5 })) {
                errors.push({ message: 'Title is too short' });
            }

            if(validator.isEmpty(args.postInput.content) || !validator.isLength(args.postInput.content, { min: 5 })) {
                errors.push({ message: 'Content is too short' });
            }

            if(errors.length > 0) {
                const error = new Error('Invalid input');
                error.data = errors;
                error.statusCode = 422;
                throw error;
            }

            const post = await Post.findById(args.postId).populate('creator');
            if(!post) {
                const error = new Error('Post not found!');
                error.statusCode = 404;
                throw error;
            }

            if(post.creator._id.toString() !== req.userId) {
                throw new Error('You are not owner of the post so you cannot update this post!');
            } 

            post.title = args.postInput.title;
            post.content = args.postInput.content;
            if(args.postInput.imageUrl !== 'undefined') {
                post.imageUrl = args.postInput.imageUrl;
            }
            const updatedPost = await post.save();
            
            return {
                ...updatedPost._doc,
                _id: updatedPost._id.toString(),
                createdAt: new Date(updatedPost.createdAt).toISOString(),
                updatedAt: new Date(updatedPost.updatedAt).toISOString()
            };
        } catch (error) {
            throw error;
        }
    },
    deletePost: async(args, req) => {
        try {
            if (!req.isAuth) {
                const error = new Error('Not authenticated!');
                error.statusCode = 401;
                throw error;
            };

            const post = await Post.findById(args.postId)
            if(!post) {
                const error = new Error('Post not found!');
                error.statusCode = 404;
                throw error;
            }

            if(post.creator.toString() !== req.userId.toString()) {
                throw new Error('You are not owner of the post so you cannot delete this post!');
            } 
            clearImage(post.imageUrl);
            const result = await Post.deleteOne({ _id: args.postId });
            if(result.deletedCount === 0) {
                throw new Error('Could not delete post');
            }
            const user = await User.findById(req.userId);
            user.posts.pull(args.postId);
            await user.save();
            return true;

        } catch (error) {
            throw error;
        }
    },
    getUserStatus: async (args, req) => {
        try {
            if (!req.isAuth) {
                const error = new Error('Not authenticated!');
                error.statusCode = 401;
                throw error;
            };

            const user = await User.findById(req.userId);
            if(!user) {
                const error = new Error('User not found!');
                error.statusCode = 404;
                throw error;
            }
            return {
                ...user._doc,
                _id: user._id.toString(),
            };
        } catch (error) {
            throw error;
        }
    },
    updateUserStatus: async (args, req) => {
        try {
            if (!req.isAuth) {
                const error = new Error('Not authenticated!');
                error.statusCode = 401;
                throw error;
            };

            const user = await User.findById(req.userId);
            if(!user) {
                const error = new Error('User not found!');
                error.statusCode = 404;
                throw error;
            }
            user.status = args.status;
            const updatedUser = await user.save();
            return {
                ...updatedUser._doc,
                _id: updatedUser._id.toString(),
            };
        } catch (error) {
            throw error;
        }
    },
};

/**@description: Testing purpose */
// module.exports = {
//     hello: () => {
//         return {
//             text: 'Hello World!',
//             views: 12345
//         };
//     }
// };