import jwt from "jsonwebtoken";

// request
// reponse 
// next allows the endpoint to proceed its like a security guard it checks the id(token) and decides 
// if the visitor(user) checks the qualification
function authMiddleware (req, res, next) {
    const token = req.headers['authorization'];

    if(!token) { return res.status(401).json(
        {message: "no token provided"}
    )};

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err) { 
            return res.status(401).json({message: "invalid token"}
        )};
        req.userId = decoded.id
        next();
    });
};  

export default authMiddleware;