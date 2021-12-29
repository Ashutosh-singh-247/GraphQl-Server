const { buildSchema } = require('graphql');

module.exports = buildSchema(`
    type Post{
        _id: ID!
        title: String!
        content: String!
        imageUrl: String!
        creator: User!
        createdAt: String!
        updatedAt: String!
    }
    type User{
        _id: ID!
        name: String!
        email: String!
        password: String
        status: String!
        posts: [Post!]!
    }
    type AuthData{
        token: String!
        userId: String!
    }
    type PostData{
        posts:[Post!]!
        totalItems: Int!
    }

    input UserInputData{
        email: String!
        name: String!
        password: String!
    }

    input PostInputData{
        title: String!
        imageUrl: String!
        content: String!
    }

    type RootQuery{
        login(email: String!, password: String!): AuthData!
        getPosts(page: Int!): PostData!
        singlePost(postId: ID!): Post!
        getUserStatus: User!
    }
    type RootMutation {
        createUser(userInput: UserInputData): User!
        createPost(postInput: PostInputData): Post!
        updatePost(postId: ID!, postInput: PostInputData): Post!
        deletePost(postId: ID!): Boolean!
        updateUserStatus(status: String!): User!
    }
    schema {
        query: RootQuery
        mutation: RootMutation
    }
`);

/**@description: Testing purpose */
// module.exports = buildSchema(`
//     type TestData {
//         text: String!
//         views: Int!
//     }
//     type RootQuery {
//         hello: TestData!
//     }
//     schema {
//         query: RootQuery
//     }
// `);