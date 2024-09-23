// cors  
const headers = { 'Access-Control-Allow-Origin': '*' };

// 简化响应创建的函数  
function createResponse(body, status = 200) {
    return new Response(body, { status, headers });
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const params = url.searchParams;

        const routes = {
            '/getComments': {
                'GET': handleGetComments,
            },
            '/insertComment': {
                'POST': handleInsertComment,
            },
            '/deleteComment': {
                'DELETE': handleDeleteComment,
            }
        };

        try {
            const route = routes[path];
            if (route && route[method]) {
                return await route[method](request, env, params);
            } else if (route) {
                return createResponse('Method Not Allowed', 405);
            } else {
                return createResponse('Not Found', 404);
            }
        } catch (err) {
            console.error('Error occurred:', err);
            return createResponse('Internal Server Error', 500);
        }
    },
};


// 验证函数，根据情况实现  
async function isAuthenticated(request) {
    
    return true;
}

// 获取评论 /getComments?blog=$blogId  
async function handleGetComments(request, env, params) {
    const blogId = params.get('blog');
    if (!blogId) {
        return createResponse('Missing blog ID', 400);
    }

    const objectKey = `${blogId}.json`;
    const commentsData = await env.MY_BUCKET.get(objectKey);

    const commentsArray = commentsData ? await commentsData.json() : [];
    return createResponse(JSON.stringify(commentsArray));
}

// 添加评论 /insertComment?blog=$blogId  
async function handleInsertComment(request, env, params) {
    if (!(await isAuthenticated(request))) {
        return createResponse('Unauthorized', 401);
    }

    const blogId = params.get('blog');
    if (!blogId) {
        return createResponse('Missing blog ID', 400);
    }

    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
        return createResponse('Invalid Content-Type', 400);
    }

    const newComment = await request.json();
    if (!newComment.content || !newComment.username) {
    // 还可以限制下文本长度之类的  
        return createResponse('Invalid Comment', 400);
    }

    const objectKey = `${blogId}.json`;
    const comment = {
        cid: crypto.randomUUID(),
        content: newComment.content,
        rid: newComment.rid,
        username: newComment.username,
        time: Date.now()
    };

    const commentsData = await env.MY_BUCKET.get(objectKey);
    const commentsArray = commentsData ? await commentsData.json() : [];

    commentsArray.push(comment);
    await env.MY_BUCKET.put(objectKey, JSON.stringify(commentsArray));

    return createResponse('Comment added');
}

// 删除评论 /deleteComment?blog=$blogId&cid=$cid  
async function handleDeleteComment(request, env, params) {
    if (!(await isAuthenticated(request))) {
        return createResponse('Unauthorized', 401);
    }

    const blogId = params.get('blog');
    const cid = params.get('cid');
    if (!blogId || !cid) {
        return createResponse('Missing blog ID or comment ID', 400);
    }

    const objectKey = `${blogId}.json`;
    const commentsData = await env.MY_BUCKET.get(objectKey);

    if (!commentsData) {
        return createResponse('No comments found', 404);
    }

    let commentsArray = await commentsData.json();
    const initialLength = commentsArray.length;

    commentsArray = commentsArray.filter(comment => (comment.cid !== cid && comment.rid !== cid));

    if (commentsArray.length === initialLength) {
        return createResponse('Comment not found', 404);
    }

    await env.MY_BUCKET.put(objectKey, JSON.stringify(commentsArray));
    return createResponse('Comment deleted');
}